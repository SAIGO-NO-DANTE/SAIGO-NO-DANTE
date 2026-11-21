'use client'
import { useEffect, useState, useRef } from 'react'
import { Node, Extension, type Editor } from '@tiptap/core'
import { NodeViewWrapper, NodeViewContent, ReactNodeViewRenderer, type NodeViewProps } from '@tiptap/react'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Table, TableRow, TableCell, TableHeader } from '@tiptap/extension-table'
import { useLocale } from 'next-intl'
import useSWR from 'swr'
import { toast } from 'sonner'
import { Plus, ChevronDown, ChevronLeft, ChevronRight, X, Search, GripVertical, Trash2, Copy } from 'lucide-react'
import NoteAssetPicker from './NoteAssetPicker'
import NoteCharacterPicker from './NoteCharacterPicker'
import BaseModal from '@/components/ui/BaseModal'
import Dropdown from '@/components/ui/Dropdown'
import { BLOCK_LABELS, CALLOUT_VARIANTS, CARD_KINDS, CARD_ID, isAssetKind, blockLabel, newBlock, youtubeId, type BlockKind, type AssetKind } from '@/lib/notes/blocks'
import { matchBlockKinds } from '@/features/notes/lib/block-menu'
import { isMentionKind } from '@/lib/notes/mention'
import { duplicateBlockAtTr, duplicateBlockTr, moveBlockAtTr, moveBlockTr } from '@/features/notes/lib/block-ops'
import { isRichClipboardHtml, pastedMarkdownContent } from '@/features/notes/lib/document'
import { assetName, type NoteAssetData } from '@/features/notes/lib/assets'
import { isNoteImageUrl, pendingNoteUploads } from '@/lib/notes/images'
import { NoteCardView, NoteCardPicker, type NoteCardKind } from './NoteCardBlock'
import { NoteCardPreview } from './NoteChips'
import { NoteAssetArtwork } from './NoteAssetArtwork'
import { NoteAssetView, NoteKeywordLabel, NoteGiftLabel, NoteMentionLabel, NoteVideo, fetchNoteAssets } from './NoteBlockViewer'
import { tr } from '@/features/notes/lib/tr'
import './note-blocks.css'
import '@/components/ui/character-picker.css'
import './note-asset-picker.css'
import './note-editor.css'

const pickTitle = (kind:BlockKind,lang:string)=>{const label=blockLabel(kind,lang);return tr(lang,`${label} 선택`,`${label}を選択`,`Choose ${kind==='ego'||kind==='youtube'?label:label.toLowerCase()}`)}
function LegacyAssetPicker({kind,onSelect,onClose}:{kind:AssetKind;onSelect:(asset:NoteAssetData)=>void;onClose:()=>void}) {
  const lang=useLocale(), [query,setQuery]=useState(''), [debounced,setDebounced]=useState(''), [offset,setOffset]=useState(0), [grade,setGrade]=useState('')
  useEffect(()=>{const timer=setTimeout(()=>{setDebounced(query);setOffset(0)},180);return()=>clearTimeout(timer)},[query])
  const {data,error,isLoading,mutate}=useSWR(`/api/notes/assets?kind=${kind}&q=${encodeURIComponent(debounced)}&offset=${offset}&grade=${grade}`,fetchNoteAssets,{revalidateOnFocus:false})
  return <BaseModal open onClose={onClose} title={pickTitle(kind,lang)} maxWidth="48rem" zIndex={10000}>
    <div className={`note-picker note-picker--${kind} note-catalog-picker`}>
      <header className="note-picker-header"><h2>{pickTitle(kind,lang)}</h2><button type="button" onClick={onClose} aria-label={tr(lang,'닫기','閉じる','Close')}><X size={20}/></button></header>
      <div className="character-picker-layout">
      <div className="note-picker-controls">
      <label className="note-picker-search"><Search size={18}/><input autoFocus value={query} onChange={e=>setQuery(e.target.value)} placeholder={tr(lang,'이름으로 검색','名前で検索','Search by name')} aria-label={tr(lang,'에셋 검색','アセット検索','Search assets')}/></label>
      {kind==='gift' && <Dropdown ariaLabel={tr(lang,'기프트 등급','ギフトランク','Gift tier')} value={grade} onChange={value=>{setGrade(value);setOffset(0)}} defaultValue="" className="note-tier-dropdown" options={[{value:'',label:tr(lang,'모든 등급','すべてのランク','All tiers')},...['I','II','III','IV','V'].map((label,i)=>({value:String(i+1),label}))]} buttonStyle={{height:'100%',minHeight:'2.75rem',fontSize:'.875rem'}}/>}
      </div>
      <div className="note-legacy-results-shell">
      <div className="note-picker-results" key={`${debounced}-${offset}-${grade}`}>
      {isLoading && <p role="status">{tr(lang,'불러오는 중…','読み込み中…','Loading…')}</p>}
      {error && <button type="button" onClick={()=>{void mutate()}}>{tr(lang,'불러오지 못했습니다. 다시 시도','読み込み失敗・再試行','Could not load. Retry')}</button>}
      {!isLoading && !error && data?.length===0 && <p>{tr(lang,'검색 결과가 없습니다','結果がありません','No results')}</p>}
      <div className={`note-picker-grid ${kind==='skill'?'note-picker-grid--skills':''}`}>
        {data?.map(a=><button type="button" key={a.id} className="note-picker-item" onClick={()=>onSelect(a)} aria-label={assetName(a,lang)}><div className="note-picker-artwork"><NoteAssetArtwork asset={a} compact/></div><span>{assetName(a,lang)}</span>{a.sinnerName && <small>{a.sinnerName}</small>}</button>)}
      </div>
      </div>
      <div className="note-picker-pages"><button type="button" disabled={!offset} onClick={()=>setOffset(Math.max(0,offset-24))}>{tr(lang,'이전','前へ','Previous')}</button><span>{Math.floor(offset/24)+1}</span><button type="button" disabled={!data || data.length<24} onClick={()=>setOffset(offset+24)}>{tr(lang,'다음','次へ','Next')}</button></div>
      </div>
      </div>
    </div>
  </BaseModal>
}
function AssetPicker(props: {kind:AssetKind;onSelect:(asset:NoteAssetData)=>void;onClose:()=>void}) { return props.kind==='identity' || props.kind==='ego' ? <NoteCharacterPicker {...props} kind={props.kind}/> : props.kind==='skill' || props.kind==='gift' ? <NoteAssetPicker {...props} kind={props.kind}/> : <LegacyAssetPicker {...props}/> }
/**
 * Swaps a block with its previous (-1) or next (+1) sibling. Touch screens cannot drag atom nodes reliably (a failed
 * drop removed the block), so blocks move with buttons.
 */
function moveNoteBlock(editor:Editor,getPos:NodeViewProps['getPos'],direction:-1|1) {
  const pos=getPos()
  if (typeof pos!=='number') return
  const tr=moveBlockAtTr(editor.state,pos,direction)
  if (tr) editor.view.dispatch(tr)
}
const duplicatedMessage=(lang:string)=>tr(lang,'블록을 복제했어요','ブロックを複製しました','Block duplicated')
/** Copies the block right after itself; the toast tells the author where the copy went. */
export function duplicateNoteBlock(editor:Editor,lang:string,getPos?:NodeViewProps['getPos']) {
  const pos=getPos?.()
  const transaction=typeof pos==='number' ? duplicateBlockAtTr(editor.state,pos) : duplicateBlockTr(editor.state)
  if (!transaction) { toast.error(tr(lang,'이 블록은 복제할 수 없어요','このブロックは複製できません','This block cannot be duplicated')); return false }
  editor.view.dispatch(transaction)
  editor.view.focus()
  toast.success(duplicatedMessage(lang))
  return true
}
/** Keyboard: Mod-Shift-Up/Down move the block around the caret, Mod-Shift-D duplicates it. */
export const NoteBlockKeys = Extension.create<{lang:string}>({name:'noteBlockKeys',addOptions(){return {lang:'ko'}},
  addKeyboardShortcuts(){
    const move=(direction:-1|1)=>()=>{const transaction=moveBlockTr(this.editor.state,direction);if(transaction)this.editor.view.dispatch(transaction);return true}
    return {'Mod-Shift-ArrowUp':move(-1),'Mod-Shift-ArrowDown':move(1),'Mod-Shift-d':()=>{duplicateNoteBlock(this.editor,this.options.lang);return true}}
  },
})
function BlockActions({editor,getPos,onDelete}:{editor:Editor;getPos:NodeViewProps['getPos'];onDelete:()=>void}) {
  const lang=useLocale()
  return <div className="note-block-actions">
    <span data-drag-handle aria-hidden="true" className="note-block-drag"><GripVertical size={14}/></span>
    <button type="button" onClick={()=>moveNoteBlock(editor,getPos,-1)} aria-label={tr(lang,'앞으로 이동','前へ移動','Move back')}><ChevronLeft size={16}/></button>
    <button type="button" onClick={()=>moveNoteBlock(editor,getPos,1)} aria-label={tr(lang,'뒤로 이동','後ろへ移動','Move forward')}><ChevronRight size={16}/></button>
    <button type="button" className="note-block-duplicate" onClick={()=>duplicateNoteBlock(editor,lang,getPos)} aria-label={tr(lang,'블록 복제','ブロック複製','Duplicate block')}><Copy size={14}/></button>
    <button type="button" className="note-block-delete" onClick={onDelete} aria-label={tr(lang,'블록 삭제','ブロック削除','Delete block')}><X size={14}/></button>
  </div>
}
function AssetNodeView({node,updateAttributes,deleteNode,selected,editor,getPos}:NodeViewProps) {
  const lang=useLocale(),[picking,setPicking]=useState(false),kind=node.attrs.kind as AssetKind
  const title=pickTitle(kind,lang)
  return <NodeViewWrapper className={`note-asset-node note-asset-node--${kind}`} data-selected={selected || undefined} contentEditable={false}>
    <BlockActions editor={editor} getPos={getPos} onDelete={deleteNode}/>
    {node.attrs.id ? <><NoteAssetView kind={kind} id={node.attrs.id}/><button className="note-asset-replace" type="button" onClick={()=>setPicking(true)}>{tr(lang,'변경','変更','Change')}</button></> : <button type="button" className={`note-empty-slot note-empty-slot--${kind}`} onClick={()=>setPicking(true)} aria-label={title}><Plus size={25}/><span>{title}</span></button>}
    {picking && <AssetPicker kind={kind} onClose={()=>setPicking(false)} onSelect={a=>{updateAttributes({id:a.id});setPicking(false)}}/>}
  </NodeViewWrapper>
}
function KeywordNodeView({node,updateAttributes}:NodeViewProps) {
  const [picking,setPicking]=useState(false), lang=useLocale()
  return <NodeViewWrapper as="span" className="note-keyword-node" contentEditable={false}>
    {node.attrs.id ? <NoteKeywordLabel id={node.attrs.id}/> : <button type="button" aria-label={pickTitle("keyword",lang)} className="note-keyword-insert" onClick={()=>setPicking(true)}><Plus size={14}/>{blockLabel('keyword',lang)}</button>}
    {picking && <AssetPicker kind="keyword" onClose={()=>setPicking(false)} onSelect={asset=>{updateAttributes({id:asset.id});setPicking(false)}}/>}
  </NodeViewWrapper>
}
function GiftInlineNodeView({node}:NodeViewProps) {
  return <NodeViewWrapper as="span" className="note-gift-inline-node" contentEditable={false}><NoteGiftLabel id={node.attrs.id} name={node.attrs.name} preview={false}/></NodeViewWrapper>
}
function MentionInlineNodeView({node}:NodeViewProps) {
  return <NodeViewWrapper as="span" className="note-mention-node" contentEditable={false}><NoteMentionLabel kind={node.attrs.kind} id={node.attrs.id} name={node.attrs.name} linked={false}/></NodeViewWrapper>
}
/** An identity or E.G.O named inside a sentence (typed with @). Stores the name too for plain text and search. */
const NoteMention = Node.create({name:'noteMention',group:'inline',inline:true,atom:true,
  addAttributes(){return {kind:{default:'identity'},id:{default:''},name:{default:''}}},
  parseHTML(){return [{tag:'span[data-note-mention]',getAttrs:el=>{const kind=el.getAttribute('data-note-mention'),id=(el.getAttribute('data-mention-id') ?? '').slice(0,150);return isMentionKind(kind)&&id?{kind,id,name:(el.textContent ?? '').slice(0,100)}:false}}]},
  renderHTML({node}){return ['span',{'data-note-mention':node.attrs.kind,'data-mention-id':node.attrs.id},node.attrs.name]},
  renderText({node}){return node.attrs.name},
  addNodeView(){return ReactNodeViewRenderer(MentionInlineNodeView)},
})
/** A gift inside a sentence, like a keyword: small art and its name. Stores the name too for plain text and search. */
const NoteGift = Node.create({name:'noteGift',group:'inline',inline:true,atom:true,
  addAttributes(){return {id:{default:''},name:{default:''}}},
  parseHTML(){return [{tag:'span[data-note-gift]',getAttrs:el=>({id:(el.getAttribute('data-note-gift') ?? '').slice(0,150),name:(el.textContent ?? '').slice(0,100)})}]},
  renderHTML({node}){return ['span',{'data-note-gift':node.attrs.id},node.attrs.name]},
  renderText({node}){return node.attrs.name},
  addNodeView(){return ReactNodeViewRenderer(GiftInlineNodeView)},
})
const NoteKeyword = Node.create({name:'noteKeyword',group:'inline',inline:true,atom:true,
  addAttributes(){return {id:{default:''}}},
  parseHTML(){return [{tag:'span[data-note-keyword]',getAttrs:el=>({id:(el.getAttribute('data-note-keyword') ?? '').slice(0,150)})}]},
  renderHTML({node}){return ['span',{'data-note-keyword':node.attrs.id},node.attrs.id]},
  renderText({node}){return node.attrs.id},
  addNodeView(){return ReactNodeViewRenderer(KeywordNodeView)},
})
function AccordionNodeView({node,updateAttributes,deleteNode}:NodeViewProps) {
  const lang=useLocale(),saved=node.attrs.collapsed===true,[closed,setClosed]=useState(saved)
  return <NodeViewWrapper className="note-accordion note-accordion-editor" data-collapsed={closed || undefined}>
    <button type="button" className="note-accordion-toggle" contentEditable={false} aria-expanded={!closed} aria-label={tr(lang,'아코디언 접기 또는 펼치기','アコーディオン開閉','Toggle accordion')} onClick={()=>setClosed(!closed)}><ChevronDown size={18}/></button>
    {/* the state readers (and this editor, next time) start with; choosing it also folds or opens it here */}
    <button type="button" className="note-accordion-default" contentEditable={false} aria-pressed={saved} onClick={()=>{updateAttributes({collapsed:!saved});setClosed(!saved)}}>{saved?tr(lang,'기본 접힘','初期状態: 閉じる','Starts closed'):tr(lang,'기본 펼침','初期状態: 開く','Starts open')}</button>
    <button type="button" className="note-accordion-delete" contentEditable={false} aria-label={tr(lang,'아코디언 삭제','アコーディオン削除','Delete accordion')} onClick={deleteNode}><X size={14}/></button>
    <NodeViewContent className="note-accordion-content"/>
  </NodeViewWrapper>
}
function VideoNodeView({node,updateAttributes,deleteNode}:NodeViewProps) {
  const lang=useLocale(),[url,setUrl]=useState(''),[error,setError]=useState(false)
  return <NodeViewWrapper className="note-video-editor" contentEditable={false}>
    <button type="button" className="note-video-delete" onClick={deleteNode} aria-label={tr(lang,'영상 삭제','動画削除','Delete video')}><X size={16}/></button>
    {node.attrs.videoId ? <NoteVideo id={node.attrs.videoId}/> : <form noValidate className="note-video-input" onSubmit={e=>{e.preventDefault();const id=youtubeId(url);setError(!id);if(id)updateAttributes({videoId:id})}}><strong>YouTube</strong><input type="url" value={url} onChange={e=>setUrl(e.target.value)} placeholder="https://www.youtube.com/watch?v=…" aria-label={tr(lang,'유튜브 링크','YouTubeリンク','YouTube URL')}/><button type="submit">{tr(lang,'영상 넣기','動画を挿入','Insert video')}</button>{error && <span role="alert">{tr(lang,'올바른 유튜브 영상 링크를 입력하세요','有効なYouTube動画URLを入力してください','Enter a valid YouTube video URL')}</span>}</form>}
  </NodeViewWrapper>
}
/** Kind names of a callout; the head above the text shows it (and, in the editor, switches it). */
const calloutLabel=(variant:string,lang:string)=>variant==='warning'?tr(lang,'주의','注意','Warning'):tr(lang,'팁','ヒント','Tip')
function CalloutNodeView({node,updateAttributes,deleteNode}:NodeViewProps) {
  const lang=useLocale(), variant=node.attrs.variant==='warning'?'warning':'tip'
  return <NodeViewWrapper as="aside" className="note-callout" data-variant={variant}>
    <div className="note-callout-head" contentEditable={false}>
      <div className="note-callout-kinds" role="group" aria-label={tr(lang,'콜아웃 종류','コールアウトの種類','Callout type')}>
        {(['tip','warning'] as const).map(v=><button key={v} type="button" data-kind={v} aria-pressed={variant===v} onClick={()=>updateAttributes({variant:v})}>{calloutLabel(v,lang)}</button>)}
      </div>
      <button type="button" className="note-callout-delete" aria-label={tr(lang,'콜아웃 삭제','コールアウト削除','Delete callout')} onClick={deleteNode}><Trash2 size={15}/></button>
    </div>
    <NodeViewContent className="note-callout-body"/>
  </NodeViewWrapper>
}
function CardNodeView({node,updateAttributes,deleteNode,selected,editor,getPos}:NodeViewProps) {
  const lang=useLocale(),[picking,setPicking]=useState(false),kind=node.attrs.kind as NoteCardKind,id=node.attrs.id as string
  const title=tr(lang,'덱·플랜 선택','デッキ・プランを選択','Choose deck or plan')
  return <NodeViewWrapper className="note-asset-node note-card-node" data-selected={selected || undefined} contentEditable={false}>
    <BlockActions editor={editor} getPos={getPos} onDelete={deleteNode}/>
    {id ? <><NoteCardView kind={kind} id={id} NotePreview={NoteCardPreview}/><button className="note-asset-replace" type="button" onClick={()=>setPicking(true)}>{tr(lang,'변경','変更','Change')}</button></> : <button type="button" className="note-empty-slot" onClick={()=>setPicking(true)} aria-label={title}><Plus size={25}/><span>{title}</span></button>}
    {picking && <NoteCardPicker kind={kind} NotePreview={NoteCardPreview} onKind={k=>updateAttributes({kind:k})} onClose={()=>setPicking(false)} onSelect={(k,cardId)=>{updateAttributes({kind:k,id:cardId});setPicking(false)}}/>}
  </NodeViewWrapper>
}
const NoteCallout = Node.create({name:'noteCallout',group:'block',content:'block+',defining:true,isolating:true,
  addAttributes(){return {variant:{default:'tip'}}},
  parseHTML(){return [{tag:'aside[data-note-callout]',getAttrs:el=>({variant:CALLOUT_VARIANTS.find(v=>v===el.getAttribute('data-note-callout')) ?? 'tip'})}]},
  renderHTML({node}){return ['aside',{'data-note-callout':node.attrs.variant},0]},
  addNodeView(){return ReactNodeViewRenderer(CalloutNodeView)},
})
const NoteCard = Node.create({name:'noteCard',group:'block',atom:true,draggable:true,
  addAttributes(){return {kind:{default:'deck'},id:{default:''}}},
  parseHTML(){return [{tag:'div[data-note-card]',getAttrs:el=>{const kind=el.getAttribute('data-note-card') as NoteCardKind,id=el.getAttribute('data-card-id') ?? '';return CARD_KINDS.includes(kind)&&(!id||CARD_ID.test(id))?{kind,id}:false}}]},
  renderHTML({node}){return ['div',{'data-note-card':node.attrs.kind,'data-card-id':node.attrs.id}]},
  addNodeView(){return ReactNodeViewRenderer(CardNodeView)},
})
function insertNoteBlock(editor:Editor,kind:BlockKind,range?:{from:number;to:number}) {
  const chain=editor.chain().focus()
  if(range)chain.deleteRange(range)
  chain.insertContent(kind==='keyword' ? [newBlock(kind),{type:'text',text:' '}] : [newBlock(kind),{type:'paragraph'}]).run()
}
const NoteAsset = Node.create({name:'noteAsset',group:'block',atom:true,draggable:true,
  addAttributes(){return {kind:{default:'gift'},id:{default:''}}},
  parseHTML(){return [{tag:'div[data-note-asset]',getAttrs:el=>{const kind=el.getAttribute('data-note-asset'),id=el.getAttribute('data-asset-id') ?? '';return isAssetKind(kind)&&id.length<=150?{kind,id}:false}}]}, renderHTML({node}){return ['div',{'data-note-asset':node.attrs.kind,'data-asset-id':node.attrs.id}]},
  // The wrapper carries the kind so phone widths can size it (a percentage on the card itself resolves against it).
  addNodeView(){return ReactNodeViewRenderer(AssetNodeView,{attrs:({node})=>({'data-kind':String(node.attrs.kind)})})},
})
export const NoteAccordion = Node.create({name:'noteAccordion',group:'block',content:'noteTitle noteBody',defining:true,isolating:true,
  addAttributes(){return {collapsed:{default:false,parseHTML:(el:HTMLElement)=>el.getAttribute('data-collapsed')==='true',renderHTML:(attrs:Record<string,unknown>)=>attrs.collapsed===true?{'data-collapsed':'true'}:{}}}},
  parseHTML(){return [{tag:'section[data-note-accordion]'}]},renderHTML({HTMLAttributes}){return ['section',{...HTMLAttributes,'data-note-accordion':''},0]},addNodeView(){return ReactNodeViewRenderer(AccordionNodeView)},
})
const NoteTitle = Node.create({name:'noteTitle',content:'inline*',defining:true,
  parseHTML(){return [{tag:'div[data-note-title]'}]},renderHTML(){return ['div',{'data-note-title':''},0]},
  addKeyboardShortcuts(){return {Enter:()=>{const {$from}=this.editor.state.selection;if($from.parent.type.name!=='noteTitle')return false;return this.editor.commands.setTextSelection($from.after()+2)}}},
})
const NoteBody = Node.create({name:'noteBody',content:'block+',defining:true,
  parseHTML(){return [{tag:'div[data-note-body]'}]},renderHTML(){return ['div',{'data-note-body':''},0]},
})
const NoteVideoNode = Node.create({name:'noteVideo',group:'block',atom:true,draggable:true,
  addAttributes(){return {videoId:{default:''}}},parseHTML(){return [{tag:'div[data-note-video]',getAttrs:el=>{const videoId=el.getAttribute('data-note-video') ?? '';return /^[\w-]{11}$/.test(videoId)?{videoId}:false}}]},renderHTML({node}){return ['div',{'data-note-video':node.attrs.videoId}]},addNodeView(){return ReactNodeViewRenderer(VideoNodeView)},
})
const NoteUpload = Node.create({name:'noteUpload',group:'block',atom:true,
  addAttributes(){return {id:{default:''}}},renderHTML(){return ['div',{'class':'note-upload','role':'status'},'↑ …']},
})
export async function uploadNoteFiles(editor:Editor,files:File[],lang:string,position?:number) {
  for (const file of files) {
    if (editor.isDestroyed) return
    if (!['image/png','image/jpeg','image/webp'].includes(file.type) || file.size>8*1024*1024) {
      toast.error(tr(lang,'PNG·JPEG·WebP, 8MB 이하 이미지를 선택해주세요.','PNG・JPEG・WebP、8MB以下を選択してください。','Choose a PNG, JPEG or WebP under 8MB.'))
      continue
    }
    const id=crypto.randomUUID()
    const findPlaceholder=()=>{
      let pos:number|undefined
      if (!editor.isDestroyed) editor.state.doc.descendants((n,p)=>{if(n.type.name==='noteUpload' && n.attrs.id===id)pos=p})
      return pos
    }
    pendingNoteUploads.add(id)
    try {
      // Insert beside the selection; an upload failure must never erase selected content.
      editor.commands.insertContentAt(position ?? editor.state.selection.to,[{type:'noteUpload',attrs:{id}},{type:'paragraph'}])
      const body=new FormData();body.append('file',file)
      const response=await fetch('/api/notes/images',{method:'POST',body})
      if (!response.ok) throw Error(response.status===401 ? tr(lang,'로그인 후 이미지를 첨부할 수 있습니다.','画像の添付にはログインが必要です。','Sign in to attach images.') : tr(lang,'이미지를 업로드하지 못했습니다. 다시 시도해주세요.','アップロードに失敗しました。','Upload failed. Please retry.'))
      const {url}=await response.json()
      if (!isNoteImageUrl(url)) throw Error('Invalid image URL')
      const pos=findPlaceholder()
      if (pos!=null) editor.commands.insertContentAt({from:pos,to:pos+1},{type:'image',attrs:{src:url,alt:file.name.replace(/\.[^.]+$/,'')}})
    } catch(e) {
      toast.error(e instanceof Error?e.message:'Upload failed')
      const pos=findPlaceholder()
      if (pos!=null) editor.commands.deleteRange({from:pos,to:pos+1})
    } finally {
      pendingNoteUploads.delete(id)
    }
    position=undefined
  }
}
export const NoteInput = Extension.create<{lang:string}>({name:'noteInput',addOptions(){return {lang:'ko'}},
  addProseMirrorPlugins(){const editor=this.editor,lang=this.options.lang;return [new Plugin({key:new PluginKey('note-input'),props:{
    handleDrop(view,event,_slice,moved){const files=Array.from(event.dataTransfer?.files ?? []);if(moved || !files.length)return false;event.preventDefault();const pos=view.posAtCoords({left:event.clientX,top:event.clientY})?.pos;void uploadNoteFiles(editor,files,lang,pos);return true},
    handlePaste(_view,event){const files=Array.from(event.clipboardData?.files ?? []);if(files.length){event.preventDefault();void uploadNoteFiles(editor,files,lang);return true}
      const text=event.clipboardData?.getData('text/plain') ?? ''
      const id=youtubeId(text.trim())
      if(id){event.preventDefault();editor.chain().insertContent([{type:'noteVideo',attrs:{videoId:id}},{type:'paragraph'}]).run();return true}
      // Rich text (a web page, a document) keeps its own formatting; plain markdown becomes blocks, but only in a body paragraph.
      const blocks=isRichClipboardHtml(event.clipboardData?.getData('text/html') ?? '') || editor.state.selection.$from.parent.type.name!=='paragraph' ? null : pastedMarkdownContent(text)
      if(!blocks)return false
      event.preventDefault();editor.chain().insertContent(blocks).run()
      toast.success(tr(lang,'마크다운을 블록으로 붙여 넣었어요','マークダウンをブロックとして貼り付けました','Pasted markdown as blocks'));return true},
  }})]},
})
export const noteBlockExtensions = [NoteAsset,NoteKeyword,NoteGift,NoteMention,NoteAccordion,NoteTitle,NoteBody,NoteVideoNode,NoteUpload,NoteCallout,NoteCard,Table,TableRow,TableCell,TableHeader]
export function notePlaceholder(lang:string,nodeType:string) {
  return nodeType==='noteTitle'?tr(lang,'아코디언 제목을 입력하세요','アコーディオンの見出し','Accordion title') : tr(lang,'여기에 글을 입력하거나 /로 블록을 추가하세요','文章を入力、または / でブロックを追加','Write here or type / to add a block')
}
export function NoteBlockMenu({editor}:{editor:Editor|null}) {
  const lang=useLocale(),[open,setOpen]=useState(false),[slash,setSlash]=useState<{from:number;to:number;query:string}|null>(null),[index,setIndex]=useState(0)
  const [picking,setPicking]=useState<'skill'|'gift'|null>(null)
  const insertion=useRef<{from:number;to:number}|null>(null)
  function choose(kind:BlockKind,range?:{from:number;to:number}) {
    if(!editor)return
    if(kind==='skill'||kind==='gift'){insertion.current=range ?? {from:editor.state.selection.from,to:editor.state.selection.to};setPicking(kind)}
    else insertNoteBlock(editor,kind,range)
    setOpen(false);setSlash(null)
  }
  const kinds=matchBlockKinds(slash?.query ?? '')
  useEffect(()=>{
    if(!editor)return
    const update=()=>{const s=editor.state.selection,before=s.$from.parent.textBetween(0,s.$from.parentOffset,'\n');const match=before.match(/(?:^|\s)\/([^\s/]*)$/);setSlash(s.empty&&match?{from:s.from-match[1].length-1,to:s.from,query:match[1]}:null);setIndex(0)}
    editor.on('update',update);editor.on('selectionUpdate',update)
    return()=>{editor.off('update',update);editor.off('selectionUpdate',update)}
  },[editor])
  useEffect(()=>{
    if(!editor || !slash || !kinds.length)return
    const handle=(e:KeyboardEvent)=>{
      if(e.isComposing||e.keyCode===229||editor.view.composing)return
      if(!['ArrowDown','ArrowUp','Tab','Enter','Escape'].includes(e.key))return
      e.preventDefault();e.stopPropagation()
      if(e.key==='Escape'){setSlash(null);return}
      if(e.key==='ArrowDown'||e.key==='ArrowUp'){setIndex(i=>(i+(e.key==='ArrowDown'?1:-1)+kinds.length)%kinds.length);return}
      choose(kinds[index] ?? kinds[0],slash)
    }
    const dom=editor.view.dom;dom.addEventListener('keydown',handle,true);return()=>dom.removeEventListener('keydown',handle,true)
  },[editor,slash,kinds,index])
  useEffect(()=>{if(!open)return;const close=(e:KeyboardEvent)=>{if(e.key==='Escape')setOpen(false)};document.addEventListener('keydown',close);return()=>document.removeEventListener('keydown',close)},[open])
  return <div className="note-block-menu">
    {picking && <NoteAssetPicker kind={picking} onClose={()=>setPicking(null)} onSelect={asset=>{
      if(!editor || !insertion.current)return
      editor.commands.insertContentAt(insertion.current,[{type:'noteAsset',attrs:{kind:picking,id:asset.id}},{type:'paragraph'}])
      insertion.current={from:editor.state.selection.to,to:editor.state.selection.to}
    }}/>}

    <button type="button" disabled={!editor} aria-expanded={open} onClick={()=>setOpen(!open)} className="note-insert-button"><Plus size={16}/>{tr(lang,'블록 삽입','ブロック挿入','Insert block')}<ChevronDown size={14}/></button>
    {(open || (slash && kinds.length>0)) && <div className="note-command-menu" role="menu" aria-label={tr(lang,'블록 선택','ブロック選択','Choose block')}>
      {kinds.map((kind,i)=><button type="button" role="menuitem" key={kind} data-active={i===index||undefined} onMouseDown={e=>e.preventDefault()} onClick={()=>{choose(kind,slash ?? undefined)}}><span>{blockLabel(kind,lang)}</span><small>/{lang==='ko'?BLOCK_LABELS[kind][0]:kind}</small>{i===index&&<kbd>Tab</kbd>}</button>)}
    </div>}
  </div>
}
