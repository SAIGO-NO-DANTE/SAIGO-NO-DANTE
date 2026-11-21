'use client'
import { createContext, useContext, useMemo, useState } from 'react'
import Image from 'next/image'
import { useLocale } from 'next-intl'
import useSWR from 'swr'
import { Search, X } from 'lucide-react'
import { computeSkillImageIndices, getSkillIconUrl, getSinnerProfileUrl } from '@/lib/utils/images'
import { toast } from 'sonner'
import Dropdown from '@/components/ui/Dropdown'
import BaseModal from '@/components/ui/BaseModal'
import KeywordSidebar from '@/components/ui/KeywordSidebar'
import { GRADE_ROMAN, GRADE_COLORS, getKeywordSlug } from '@/lib/planner/gift-plan-constants'
import SkillFrame from '@/features/catalog/components/SkillFrame'
import { buildSkillVariantMap, selectIdentitySkills } from '@/lib/identity/skill-model'
import { normalizeSin, SIN_COLORS } from '@/lib/constants/sin'
import SkillDescription from '@/features/catalog/components/SkillDescription'
import { assetName, type NoteAssetData, type NoteFormationMember } from '@/features/notes/lib/assets'
import { foundAssetIds } from '@/features/notes/lib/asset-search'
import { NoteAssetArtwork } from './NoteAssetArtwork'
import { fetchNoteAssets } from './NoteBlockViewer'
import '@/components/ui/character-picker.css'
import './note-asset-picker.css'

const GRADE_ORDER = ['EX','5','4','3','2','1']
function SkillPickerFrame({asset,lang}:{asset:NoteAssetData;lang:string}) {
  const {skill,identity}=asset
  if (!skill || !identity) return null
  const skills=selectIdentitySkills(asset.skills ?? [skill],4)
  const variant=buildSkillVariantMap(skills)[skill.id]
  const order=variant?.baseOrder ?? skill.skill_order
  const suffix=variant && variant.idx>1 ? `-${variant.idx}` : ''
  const label=order===4
    ? `${lang==='ja'?'守備':lang==='en'?'Defense':'수비'}${suffix}`
    : `${lang==='ja'?'スキル':lang==='en'?'Skill':'스킬'} ${order}${suffix}`
  const sin=normalizeSin(skill.sin_affinity) ?? 'neutral'
  return <><SkillFrame
    skillIconUrl={getSkillIconUrl(identity,computeSkillImageIndices(skills)[skill.id] ?? skill.skill_order,skill)}
    sin={sin} sinColor={sin==='neutral'?'#ccc':SIN_COLORS[sin]}
    skillSlot={order} label={label} size="5rem"
  /><span>{label}</span></>
}
export const NoteFormationContext = createContext<NoteFormationMember[]>([])
export default function NoteAssetPicker({kind,onSelect,onClose}: {kind:'gift'|'skill';onSelect:(asset:NoteAssetData)=>void;onClose:()=>void}) {
  const lang=useLocale(), formation=useContext(NoteFormationContext)
  const tr=(ko:string,ja:string,en:string)=>lang==='ja'?ja:lang==='en'?en:ko
  const [query,setQuery]=useState(''), [grade,setGrade]=useState(''), [sinner,setSinner]=useState(''), [keyword,setKeyword]=useState<string|null>(null), [preview,setPreview]=useState<NoteAssetData|null>(null)
  const ids=formation.map(m=>m.identityId).join(',')
  const {data=[],error,isLoading,mutate}=useSWR(kind==='gift' ? '/api/notes/assets?kind=gift&catalog=1' : `/api/notes/assets?kind=skill&identities=${encodeURIComponent(ids)}`,fetchNoteAssets,{revalidateOnFocus:false})
  const counts=new Map<string|null,number>([[null,data.length]])
  for(const a of data) {const slug=getKeywordSlug(a.keyword ?? null);counts.set(slug,(counts.get(slug)??0)+1)}
  const found=useMemo(()=>foundAssetIds(data,query),[data,query])
  const filtered=data.filter(a=>(!grade || String(a.grade)===grade) && (!sinner || a.identity?.sinner_id===sinner) && (!keyword || getKeywordSlug(a.keyword ?? null)===keyword) && (!found || found.has(a.id)))
  const groups=kind==='gift' ? GRADE_ORDER.map(g=>({id:g,name:`${GRADE_ROMAN[g]??g} ${tr('등급','ランク','Tier')}`,items:filtered.filter(a=>String(a.grade)===g)})) : formation.filter(m=>!sinner||m.sinnerId===sinner).map(m=>({id:m.sinnerId,name:m.name,items:filtered.filter(a=>a.identity?.id===m.identityId).sort((a,b)=>(a.skill?.skill_order??0)-(b.skill?.skill_order??0))}))
  const shown=preview && filtered.some(a=>a.id===preview.id) ? preview : filtered[0]
  const title=kind==='gift'?tr('기프트 추가','ギフトを追加','Add gift'):tr('스킬 추가','スキルを追加','Add skill')
  function add(a:NoteAssetData) {onSelect(a);onClose();toast.success(`${assetName(a,lang)} ${tr('추가됨','追加しました','added')}`)}
  return <BaseModal open onClose={onClose} title={title} maxWidth="78rem" zIndex={10000}>
    <div className={`note-picker note-direct-picker note-direct-picker--${kind}`}>
      <header className="note-picker-header"><h2>{title}</h2><button type="button" onClick={onClose} aria-label={tr('닫기','閉じる','Close')}><X size={22}/></button></header>
      <div className="note-direct-layout">
        <nav className="note-direct-sidebar" aria-label={tr('필터','フィルター','Filters')}>
<div className="note-picker-controls"><label className="note-picker-search"><Search size={18}/><input autoFocus value={query} onChange={e=>setQuery(e.target.value)} placeholder={tr('이름으로 검색','名前で検索','Search by name')} aria-label={tr('이름으로 검색','名前で検索','Search by name')}/></label>
        {kind==='gift' && <Dropdown
          ariaLabel={tr('기프트 등급','ギフトランク','Gift tier')}
          value={grade}
          onChange={setGrade}
          defaultValue=""
          className="note-tier-dropdown"
          options={[{value:'',label:tr('모든 등급','すべてのランク','All tiers')},...GRADE_ORDER.map(g=>({value:g,label:GRADE_ROMAN[g]??g}))]}
          buttonStyle={{height:'100%',minHeight:'2.75rem',fontSize:'.875rem'}}
        />}

      </div>
          {kind==='gift' ? <KeywordSidebar activeSlug={keyword} onSelect={setKeyword} giftCounts={counts}/> : <><button type="button" aria-pressed={!sinner} onClick={()=>setSinner('')}>{tr('전체','すべて','All')}</button>{formation.map(m=><button key={m.sinnerId} type="button" aria-pressed={sinner===m.sinnerId} onClick={()=>setSinner(m.sinnerId)}><Image src={getSinnerProfileUrl(m.sinnerId)} alt="" width={28} height={28}/>{m.name}</button>)}</>}
        </nav>
        <div className="note-picker-results">
          {isLoading && <p role="status">{tr('불러오는 중…','読み込み中…','Loading…')}</p>}
          {error && <button type="button" onClick={()=>void mutate()}>{tr('불러오기 실패 · 다시 시도','再試行','Load failed · Retry')}</button>}
          {!isLoading && !error && !filtered.length && <p className="note-picker-empty" role="status">{kind==='skill' && !formation.length ? tr('덱에 인격을 추가하면 스킬이 표시됩니다.','デッキに人格を追加するとスキルが表示されます。','Add an identity to your deck to see its skills.') : tr('검색 결과가 없습니다','結果がありません','No results')}</p>}
          {groups.filter(g=>g.items.length).map(g=><section key={g.id}><h3 style={{color:kind==='gift'?GRADE_COLORS[g.id]:undefined}}>{g.name} <small>{g.items.length}</small></h3><div className="note-direct-grid">{g.items.map(a=><button type="button" key={a.id} className="note-direct-item" onMouseEnter={()=>setPreview(a)} onFocus={()=>setPreview(a)} onClick={()=>add(a)} aria-label={`${assetName(a,lang)} ${tr('추가','追加','Add')}`}>{kind==='skill' ? <SkillPickerFrame asset={a} lang={lang}/> : <><NoteAssetArtwork asset={a} compact/><span>{assetName(a,lang)}</span></>}</button>)}</div></section>)}
        </div>
        {kind==='gift' && shown && <aside className="note-direct-preview"><NoteAssetArtwork asset={shown}/><h3>{assetName(shown,lang)}</h3><SkillDescription accentColor="#c8900a" description={(lang==='en'?shown.description_en:lang==='ja'?shown.description_jp:null) || shown.description || (lang==='en'?shown.skill?.description_en:lang==='ja'?shown.skill?.description_jp:null) || shown.skill?.description || ''} variant="compact"/></aside>}
      </div>
    </div>
  </BaseModal>
}
