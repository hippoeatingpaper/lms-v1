# 공동 편집 프론트엔드 스펙 (Collaborative Editing)

> TipTap + Yjs 기반 실시간 공동 문서 편집 UI 구현

## 필요 패키지

```bash
npm install \
  @tiptap/react \
  @tiptap/starter-kit \
  @tiptap/extension-collaboration \
  @tiptap/extension-collaboration-cursor \
  yjs \
  y-websocket
```

## 페이지 구조

### DocEditor.tsx (`/class/:classId/docs/:docId`)

**데스크톱 (교사/태블릿)**:
```
┌──────────────────────────────────────────────────────────────┐
│ ← 문서 편집        [제목 input]        저장됨 ● 👤👤👤 +2    │
├───────────┬──────────────────────────────────────────────────┤
│ 문서 목록  │  ┌────────────────────────────────────────────┐ │
│           │  │ [B] [I] [H1] [H2] [•] [1.] [—] [↩]        │ │
│ 📄 기획서  │  ├────────────────────────────────────────────┤ │
│ 📄 보고서 ←│  │                                            │ │
│ 📄 회의록  │  │  편집 영역 (TipTap)                        │ │
│           │  │                                            │ │
│ [+ 새 문서]│  │  김민준| ← 팀원 커서 (보라색)               │ │
│           │  │                                            │ │
│           │  │  여기에 내용을 작성합니다...                │ │
│           │  │                                            │ │
│           │  └────────────────────────────────────────────┘ │
├───────────┴──────────────────────────────────────────────────┤
│ 🟢 3명 온라인                                    단어 수: 128 │
└──────────────────────────────────────────────────────────────┘
```

**모바일 (학생)**:
```
┌─────────────────────────────────────────┐
│ ← 기획서                   저장됨 👤👤+1│
├─────────────────────────────────────────┤
│ [B] [I] [H] [•] [1.] ... (가로 스크롤)  │
├─────────────────────────────────────────┤
│                                         │
│  편집 영역 (전체 화면)                   │
│                                         │
│  이서연| ← 커서                          │
│                                         │
└─────────────────────────────────────────┘
│ 🟢 3명 온라인              단어: 128    │
└─────────────────────────────────────────┘
```

## 컴포넌트 구조

```
DocEditor/
├── DocEditor.tsx           # 메인 페이지
├── DocumentSidebar.tsx     # 문서 목록 사이드바
├── EditorToolbar.tsx       # 서식 툴바
├── TipTapEditor.tsx        # TipTap 에디터 래퍼
├── CollaboratorCursors.tsx # 팀원 커서 표시
├── EditorHeader.tsx        # 제목 + 저장상태 + 아바타
└── EditorFooter.tsx        # 온라인 인원 + 단어 수
```

## TipTap 에디터 설정

### lib/yjs.ts — WebSocket 프로바이더

```ts
// client/src/lib/yjs.ts
import * as Y from 'yjs'
import { WebsocketProvider } from 'y-websocket'
import { useAuthStore } from '../stores/authStore'

export function createYjsProvider(docId: string) {
  const ydoc = new Y.Doc()

  // JWT 토큰을 쿼리 파라미터로 전달
  const token = useAuthStore.getState().accessToken
  const wsUrl = `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/yjs/${docId}?token=${token}`

  const provider = new WebsocketProvider(wsUrl, docId.toString(), ydoc, {
    connect: true,
  })

  return { ydoc, provider }
}
```

### TipTapEditor.tsx — 에디터 컴포넌트

```tsx
// client/src/pages/DocEditor/TipTapEditor.tsx
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Collaboration from '@tiptap/extension-collaboration'
import CollaborationCursor from '@tiptap/extension-collaboration-cursor'
import { useEffect, useState } from 'react'
import { createYjsProvider } from '@/lib/yjs'
import { useAuthStore } from '@/stores/authStore'

interface TipTapEditorProps {
  docId: string
  onSyncStatusChange: (synced: boolean) => void
  onOnlineCountChange: (count: number) => void
}

// 커서 색상 (AVATAR_COLORS와 동일)
const CURSOR_COLORS = [
  { color: '#3C3489', light: '#EEEDFE' },
  { color: '#085041', light: '#E1F5EE' },
  { color: '#993C1D', light: '#FAECE7' },
  { color: '#633806', light: '#FAEEDA' },
  { color: '#0C447C', light: '#E6F1FB' },
]

export function TipTapEditor({
  docId,
  onSyncStatusChange,
  onOnlineCountChange
}: TipTapEditorProps) {
  const user = useAuthStore((s) => s.user)
  const [provider, setProvider] = useState<WebsocketProvider | null>(null)
  const [ydoc, setYdoc] = useState<Y.Doc | null>(null)

  // Yjs 프로바이더 설정
  useEffect(() => {
    const { ydoc, provider } = createYjsProvider(docId)
    setYdoc(ydoc)
    setProvider(provider)

    // 동기화 상태
    provider.on('sync', (synced: boolean) => {
      onSyncStatusChange(synced)
    })

    // 온라인 인원 (awareness)
    provider.awareness.on('change', () => {
      const states = provider.awareness.getStates()
      onOnlineCountChange(states.size)
    })

    return () => {
      provider.destroy()
      ydoc.destroy()
    }
  }, [docId])

  // TipTap 에디터
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        history: false,  // Yjs가 히스토리 관리
      }),
      Collaboration.configure({
        document: ydoc,
      }),
      CollaborationCursor.configure({
        provider,
        user: {
          name: user?.name || '익명',
          color: CURSOR_COLORS[user?.id % CURSOR_COLORS.length].color,
        },
      }),
    ],
    editorProps: {
      attributes: {
        class: 'prose prose-sm max-w-none focus:outline-none min-h-[400px] p-4',
      },
    },
  }, [ydoc, provider])

  if (!editor) {
    return <div className="animate-pulse bg-gray-100 h-96 rounded-lg" />
  }

  return (
    <div className="border border-black/10 rounded-xl overflow-hidden bg-white">
      <EditorToolbar editor={editor} />
      <EditorContent editor={editor} />
    </div>
  )
}
```

### EditorToolbar.tsx — 서식 툴바

```tsx
// client/src/pages/DocEditor/EditorToolbar.tsx
import { Editor } from '@tiptap/react'
import {
  Bold, Italic, Heading1, Heading2,
  List, ListOrdered, Minus, CornerDownLeft
} from 'lucide-react'

interface EditorToolbarProps {
  editor: Editor
}

export function EditorToolbar({ editor }: EditorToolbarProps) {
  const tools = [
    {
      icon: Bold,
      action: () => editor.chain().focus().toggleBold().run(),
      isActive: editor.isActive('bold'),
      label: '굵게',
    },
    {
      icon: Italic,
      action: () => editor.chain().focus().toggleItalic().run(),
      isActive: editor.isActive('italic'),
      label: '기울임',
    },
    {
      icon: Heading1,
      action: () => editor.chain().focus().toggleHeading({ level: 1 }).run(),
      isActive: editor.isActive('heading', { level: 1 }),
      label: '제목 1',
    },
    {
      icon: Heading2,
      action: () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
      isActive: editor.isActive('heading', { level: 2 }),
      label: '제목 2',
    },
    {
      icon: List,
      action: () => editor.chain().focus().toggleBulletList().run(),
      isActive: editor.isActive('bulletList'),
      label: '글머리 기호',
    },
    {
      icon: ListOrdered,
      action: () => editor.chain().focus().toggleOrderedList().run(),
      isActive: editor.isActive('orderedList'),
      label: '번호 매기기',
    },
    {
      icon: Minus,
      action: () => editor.chain().focus().setHorizontalRule().run(),
      isActive: false,
      label: '구분선',
    },
    {
      icon: CornerDownLeft,
      action: () => editor.chain().focus().setHardBreak().run(),
      isActive: false,
      label: '줄바꿈',
    },
  ]

  return (
    <div className="flex items-center gap-0.5 p-2 border-b border-black/10 bg-[#F7F6F3] overflow-x-auto">
      {tools.map(({ icon: Icon, action, isActive, label }) => (
        <button
          key={label}
          onClick={action}
          title={label}
          className={`
            w-7 h-7 rounded-[5px] flex items-center justify-center transition-colors
            ${isActive
              ? 'bg-[#EEEDFE] text-[#534AB7]'
              : 'text-gray-500 hover:bg-white'
            }
          `}
        >
          <Icon size={16} strokeWidth={1.5} />
        </button>
      ))}
    </div>
  )
}
```

### EditorHeader.tsx — 상단 바

```tsx
// client/src/pages/DocEditor/EditorHeader.tsx
import { useState, useEffect } from 'react'
import { ChevronLeft } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Input, AvatarGroup, Badge } from '@/components/ui'
import { api } from '@/lib/api'

interface EditorHeaderProps {
  docId: string
  initialTitle: string
  synced: boolean
  collaborators: Array<{ id: number; name: string }>
}

export function EditorHeader({
  docId,
  initialTitle,
  synced,
  collaborators
}: EditorHeaderProps) {
  const navigate = useNavigate()
  const [title, setTitle] = useState(initialTitle)
  const [saving, setSaving] = useState(false)

  // 제목 변경 디바운스 저장
  useEffect(() => {
    if (title === initialTitle) return

    const timer = setTimeout(async () => {
      setSaving(true)
      await api(`/documents/${docId}`, {
        method: 'PATCH',
        body: JSON.stringify({ title })
      })
      setSaving(false)
    }, 1000)

    return () => clearTimeout(timer)
  }, [title])

  return (
    <div className="flex items-center justify-between px-4 py-2 border-b border-black/10">
      {/* 뒤로가기 + 제목 */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="p-1 hover:bg-gray-100 rounded"
        >
          <ChevronLeft size={20} strokeWidth={1.5} />
        </button>

        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="border-0 bg-transparent font-medium text-[15px] w-48 focus:bg-white focus:border-brand-mid"
          placeholder="문서 제목"
        />
      </div>

      {/* 저장 상태 + 아바타 */}
      <div className="flex items-center gap-3">
        {/* 저장 상태 pill */}
        {saving ? (
          <Badge variant="amber">저장 중...</Badge>
        ) : synced ? (
          <Badge variant="teal">저장됨</Badge>
        ) : (
          <Badge variant="gray">연결 중...</Badge>
        )}

        {/* 협업자 아바타 */}
        <AvatarGroup
          names={collaborators.map(c => c.name)}
          max={3}
        />
      </div>
    </div>
  )
}
```

### DocumentSidebar.tsx — 문서 목록

```tsx
// client/src/pages/DocEditor/DocumentSidebar.tsx
import { useEffect, useState } from 'react'
import { FileText, Plus } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button } from '@/components/ui'
import { api } from '@/lib/api'

interface Document {
  id: number
  title: string
  updated_at: string
}

export function DocumentSidebar({ teamId }: { teamId: number }) {
  const navigate = useNavigate()
  const { docId } = useParams()
  const [documents, setDocuments] = useState<Document[]>([])

  useEffect(() => {
    loadDocuments()
  }, [teamId])

  async function loadDocuments() {
    const { documents } = await api<{ documents: Document[] }>(
      `/teams/${teamId}/documents`
    )
    setDocuments(documents)
  }

  async function createDocument() {
    const { document } = await api<{ document: Document }>(
      `/teams/${teamId}/documents`,
      { method: 'POST', body: JSON.stringify({ title: '새 문서' }) }
    )
    setDocuments([document, ...documents])
    navigate(`/docs/${document.id}`)
  }

  return (
    <aside className="w-[200px] border-r border-black/8 flex flex-col h-full">
      <div className="p-3 border-b border-black/8">
        <h3 className="text-xs font-medium text-gray-500 tracking-wider">
          팀 문서
        </h3>
      </div>

      <nav className="flex-1 overflow-y-auto p-2">
        {documents.map((doc) => (
          <button
            key={doc.id}
            onClick={() => navigate(`/docs/${doc.id}`)}
            className={`
              w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left text-xs
              ${doc.id === Number(docId)
                ? 'bg-[#EEEDFE] text-[#3C3489] font-medium border-r-2 border-[#534AB7]'
                : 'text-gray-600 hover:bg-gray-50'
              }
            `}
          >
            <FileText size={14} strokeWidth={1.5} />
            <span className="truncate">{doc.title}</span>
          </button>
        ))}
      </nav>

      <div className="p-3 border-t border-black/8">
        <Button
          variant="secondary"
          size="sm"
          className="w-full"
          onClick={createDocument}
        >
          <Plus size={14} className="mr-1" />
          새 문서
        </Button>
      </div>
    </aside>
  )
}
```

### EditorFooter.tsx — 하단 바

```tsx
// client/src/pages/DocEditor/EditorFooter.tsx

export function EditorFooter({
  onlineCount,
  wordCount
}: {
  onlineCount: number
  wordCount: number
}) {
  return (
    <div className="flex items-center justify-between px-4 py-2 border-t border-black/10 text-xs text-gray-500">
      <div className="flex items-center gap-1.5">
        <span className="w-1.5 h-1.5 rounded-full bg-[#1D9E75]" />
        <span>{onlineCount}명 온라인</span>
      </div>
      <span>단어 수: {wordCount.toLocaleString()}</span>
    </div>
  )
}
```

### DocEditor.tsx — 메인 페이지

```tsx
// client/src/pages/DocEditor/DocEditor.tsx
import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { api } from '@/lib/api'
import { BlockedState } from '@/components/ui'
import { Lock } from 'lucide-react'

import { DocumentSidebar } from './DocumentSidebar'
import { EditorHeader } from './EditorHeader'
import { TipTapEditor } from './TipTapEditor'
import { EditorFooter } from './EditorFooter'

export default function DocEditor() {
  const { docId } = useParams<{ docId: string }>()
  const user = useAuthStore((s) => s.user)

  const [document, setDocument] = useState<any>(null)
  const [synced, setSynced] = useState(false)
  const [onlineCount, setOnlineCount] = useState(1)
  const [collaborators, setCollaborators] = useState<any[]>([])
  const [wordCount, setWordCount] = useState(0)

  // 팀 미배정 체크
  if (user?.role === 'student' && !user.team_id) {
    return (
      <BlockedState
        icon={Lock}
        title="팀 배정이 필요합니다"
        description="공동 문서를 편집하려면 먼저 팀에 배정되어야 합니다."
      />
    )
  }

  useEffect(() => {
    if (docId) {
      loadDocument()
    }
  }, [docId])

  async function loadDocument() {
    const data = await api<any>(`/documents/${docId}`)
    setDocument(data.document)
  }

  if (!document) {
    return <div className="animate-pulse" />
  }

  return (
    <div className="flex h-screen">
      {/* 사이드바 (데스크톱) */}
      <div className="hidden md:block">
        <DocumentSidebar teamId={document.team_id} />
      </div>

      {/* 메인 에디터 영역 */}
      <div className="flex-1 flex flex-col">
        <EditorHeader
          docId={docId!}
          initialTitle={document.title}
          synced={synced}
          collaborators={collaborators}
        />

        <main className="flex-1 overflow-y-auto p-4 bg-[#F7F6F3]">
          <div className="max-w-3xl mx-auto">
            <TipTapEditor
              docId={docId!}
              onSyncStatusChange={setSynced}
              onOnlineCountChange={setOnlineCount}
            />
          </div>
        </main>

        <EditorFooter
          onlineCount={onlineCount}
          wordCount={wordCount}
        />
      </div>
    </div>
  )
}
```

## 커서 스타일

### CollaborationCursor 커스텀 렌더링

```tsx
// TipTap CollaborationCursor는 자동으로 커서를 렌더링
// 추가 스타일링이 필요하면 CSS로 커스터마이징

/* styles/editor.css */
.collaboration-cursor__caret {
  position: relative;
  margin-left: -1px;
  margin-right: -1px;
  border-left: 2px solid;
  border-right: none;
  word-break: normal;
  pointer-events: none;
}

.collaboration-cursor__label {
  position: absolute;
  top: -1.4em;
  left: -1px;
  font-size: 9px;
  font-weight: 500;
  line-height: 1;
  white-space: nowrap;
  color: white;
  padding: 2px 4px;
  border-radius: 3px;
  user-select: none;
}
```

## 상태 관리

### 연결 상태 (connectionStore와 통합)

```ts
// stores/connectionStore.ts에 Yjs 상태 추가
interface ConnectionState {
  isOnline: boolean
  socketConnected: boolean
  yjsConnected: boolean      // Yjs 연결 상태
  yjsSynced: boolean         // Yjs 동기화 완료 여부
  // ...
}
```

### 재연결 처리

```tsx
// y-websocket은 자동 재연결 지원
// CRDT 특성상 재연결 시 자동으로 상태 동기화됨

provider.on('status', ({ status }) => {
  if (status === 'connected') {
    console.log('[yjs] 연결됨')
    useConnectionStore.getState().setYjsConnected(true)
  } else if (status === 'disconnected') {
    console.log('[yjs] 연결 끊김')
    useConnectionStore.getState().setYjsConnected(false)
  }
})
```

## 모바일 최적화

```tsx
// 모바일에서는 사이드바 숨김
<div className="hidden md:block">
  <DocumentSidebar />
</div>

// 툴바 가로 스크롤
<div className="overflow-x-auto flex gap-0.5 p-2">
  {tools.map(...)}
</div>

// 터치 친화적 버튼 크기
<button className="w-8 h-8 md:w-7 md:h-7">
```

## 에러 처리

```tsx
// WebSocket 연결 실패 시
provider.on('connection-error', (event) => {
  console.error('[yjs] 연결 오류:', event)
  toast.error('문서 서버에 연결할 수 없습니다.')
})

// 인증 만료 시 (4001 코드)
provider.ws?.addEventListener('close', (event) => {
  if (event.code === 4001) {
    toast.error('세션이 만료되었습니다. 다시 로그인해주세요.')
    navigate('/login')
  }
})
```

## 단어 수 계산

```ts
// TipTap 에디터에서 단어 수 추출
const wordCount = editor.storage.characterCount?.words() ?? 0

// 또는 직접 계산
const text = editor.getText()
const wordCount = text.trim().split(/\s+/).filter(Boolean).length
```
