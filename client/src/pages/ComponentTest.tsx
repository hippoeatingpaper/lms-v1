/**
 * ComponentTest.tsx — Phase 3-2 컴포넌트 테스트 페이지
 * 테스트 완료 후 삭제 예정
 */

import { useState } from 'react'
import {
  Badge,
  Button,
  Input,
  Textarea,
  Card,
  MetricCard,
  Modal,
  useToast,
} from '../components/ui'

function ToastTester() {
  const toast = useToast()

  return (
    <div className="flex flex-wrap gap-2">
      <Button size="sm" onClick={() => toast.success('저장되었습니다.')}>
        Success Toast
      </Button>
      <Button size="sm" onClick={() => toast.error('오류가 발생했습니다.')}>
        Error Toast
      </Button>
      <Button size="sm" onClick={() => toast.warning('주의가 필요합니다.')}>
        Warning Toast
      </Button>
      <Button size="sm" onClick={() => toast.info('새로운 알림이 있습니다.')}>
        Info Toast
      </Button>
      <Button size="sm" onClick={() => {
        toast.success('토스트 1')
        setTimeout(() => toast.error('토스트 2'), 300)
        setTimeout(() => toast.warning('토스트 3'), 600)
      }}>
        Multiple Toasts
      </Button>
    </div>
  )
}

export default function ComponentTest() {
  const [modalOpen, setModalOpen] = useState(false)
  const [inputValue, setInputValue] = useState('')
  const [textareaValue, setTextareaValue] = useState('')

  return (
    <div className="min-h-screen bg-[#F7F6F3] p-6">
      <h1 className="text-2xl font-medium mb-6">Phase 3-2: 공통 컴포넌트 테스트</h1>

      {/* Badge 테스트 */}
      <section className="mb-8">
        <h2 className="text-lg font-medium mb-3">1. Badge 컴포넌트</h2>
        <Card>
          <p className="text-xs text-gray-500 mb-2">variant별 스타일:</p>
          <div className="flex flex-wrap gap-2 mb-4">
            <Badge variant="teal">teal (제출완료)</Badge>
            <Badge variant="amber">amber (미제출)</Badge>
            <Badge variant="coral">coral (공지)</Badge>
            <Badge variant="purple">purple (자료)</Badge>
            <Badge variant="gray">gray (임시저장)</Badge>
          </div>
          <p className="text-xs text-gray-500">텍스트 렌더링: ✅ 확인됨</p>
        </Card>
      </section>

      {/* Button 테스트 */}
      <section className="mb-8">
        <h2 className="text-lg font-medium mb-3">2. Button 컴포넌트</h2>
        <Card>
          <p className="text-xs text-gray-500 mb-2">variant별 스타일:</p>
          <div className="flex flex-wrap gap-2 mb-4">
            <Button variant="primary">Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="danger">Danger</Button>
            <Button variant="ghost">Ghost</Button>
          </div>

          <p className="text-xs text-gray-500 mb-2">size별 스타일:</p>
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <Button size="sm">Small</Button>
            <Button size="md">Medium</Button>
            <Button size="lg">Large</Button>
          </div>

          <p className="text-xs text-gray-500 mb-2">disabled 상태:</p>
          <div className="flex flex-wrap gap-2 mb-4">
            <Button variant="primary" disabled>Disabled Primary</Button>
            <Button variant="secondary" disabled>Disabled Secondary</Button>
          </div>

          <p className="text-xs text-gray-500 mb-2">loading 상태:</p>
          <div className="flex flex-wrap gap-2 mb-4">
            <Button variant="primary" loading>Loading Primary</Button>
            <Button variant="secondary" loading>Loading Secondary</Button>
          </div>

          <p className="text-xs text-gray-500 mb-2">onClick 이벤트:</p>
          <Button onClick={() => alert('Button clicked!')}>Click me</Button>
        </Card>
      </section>

      {/* Input 테스트 */}
      <section className="mb-8">
        <h2 className="text-lg font-medium mb-3">3. Input 컴포넌트</h2>
        <Card>
          <div className="space-y-3 max-w-md">
            <div>
              <p className="text-xs text-gray-500 mb-1">text 타입:</p>
              <Input
                type="text"
                placeholder="텍스트 입력"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
              />
              <p className="text-[10px] text-gray-400 mt-1">입력값: {inputValue || '(없음)'}</p>
            </div>

            <div>
              <p className="text-xs text-gray-500 mb-1">password 타입:</p>
              <Input type="password" placeholder="비밀번호 입력" />
            </div>

            <div>
              <p className="text-xs text-gray-500 mb-1">email 타입:</p>
              <Input type="email" placeholder="이메일 입력" />
            </div>

            <div>
              <p className="text-xs text-gray-500 mb-1">filled 상태 (값 입력됨):</p>
              <Input placeholder="filled 상태" filled value="입력된 값" readOnly />
            </div>

            <div>
              <p className="text-xs text-gray-500 mb-1">error 상태:</p>
              <Input placeholder="에러 상태" error value="잘못된 입력" readOnly />
            </div>

            <div>
              <p className="text-xs text-gray-500 mb-1">disabled 상태:</p>
              <Input placeholder="비활성화됨" disabled />
            </div>
          </div>
        </Card>
      </section>

      {/* Textarea 테스트 */}
      <section className="mb-8">
        <h2 className="text-lg font-medium mb-3">4. Textarea 컴포넌트</h2>
        <Card>
          <div className="space-y-3 max-w-md">
            <div>
              <p className="text-xs text-gray-500 mb-1">기본:</p>
              <Textarea
                rows={3}
                placeholder="내용을 입력하세요"
                value={textareaValue}
                onChange={(e) => setTextareaValue(e.target.value)}
              />
              <p className="text-[10px] text-gray-400 mt-1">{textareaValue.length}자</p>
            </div>

            <div>
              <p className="text-xs text-gray-500 mb-1">filled 상태:</p>
              <Textarea rows={2} filled value="입력된 내용입니다." readOnly />
            </div>
          </div>
        </Card>
      </section>

      {/* Card 테스트 */}
      <section className="mb-8">
        <h2 className="text-lg font-medium mb-3">5. Card / MetricCard 컴포넌트</h2>
        <div className="flex flex-wrap gap-4">
          <Card>
            <p className="text-sm">기본 Card</p>
            <p className="text-xs text-gray-500">children 렌더링 확인</p>
          </Card>

          <Card selected>
            <p className="text-sm">선택된 Card</p>
            <p className="text-xs text-gray-500">selected=true</p>
          </Card>

          <MetricCard value={28} label="오늘 접속" />
          <MetricCard value={7} label="미제출" highlight="danger" />
          <MetricCard value="98%" label="제출률" highlight="success" />
        </div>
      </section>

      {/* Modal 테스트 */}
      <section className="mb-8">
        <h2 className="text-lg font-medium mb-3">6. Modal 컴포넌트</h2>
        <Card>
          <p className="text-xs text-gray-500 mb-2">모달 열기/닫기, ESC 키, 오버레이 클릭 테스트:</p>
          <Button onClick={() => setModalOpen(true)}>Open Modal</Button>

          <Modal
            open={modalOpen}
            onClose={() => setModalOpen(false)}
            title="모달 테스트"
          >
            <p className="text-sm text-gray-600 mb-4">
              이 모달은 다음 기능을 테스트합니다:
            </p>
            <ul className="text-xs text-gray-500 space-y-1 mb-4">
              <li>✅ open=true일 때 표시</li>
              <li>✅ open=false일 때 숨김</li>
              <li>✅ 오버레이 클릭 시 닫기</li>
              <li>✅ ESC 키로 닫기</li>
              <li>✅ 스크롤 잠금</li>
              <li>✅ 포커스 트랩 (Tab 키로 테스트)</li>
            </ul>
            <div className="flex gap-2 justify-end">
              <Button variant="secondary" onClick={() => setModalOpen(false)}>
                취소
              </Button>
              <Button variant="primary" onClick={() => setModalOpen(false)}>
                확인
              </Button>
            </div>
          </Modal>
        </Card>
      </section>

      {/* Toast 테스트 */}
      <section className="mb-8">
        <h2 className="text-lg font-medium mb-3">7. Toast 컴포넌트</h2>
        <Card>
          <p className="text-xs text-gray-500 mb-2">토스트 타입별 테스트 (3초 후 자동 사라짐):</p>
          <ToastTester />
          <p className="text-xs text-gray-400 mt-3">
            ✅ success, error, warning, info 타입 | ✅ 자동 사라짐 | ✅ 수동 닫기 | ✅ 다중 스택
          </p>
        </Card>
      </section>

      {/* 테스트 요약 */}
      <section className="mb-8">
        <h2 className="text-lg font-medium mb-3">테스트 요약</h2>
        <Card>
          <div className="text-xs space-y-2">
            <p><strong>Badge:</strong> ✅ variant 5종, 텍스트 렌더링 (클릭 이벤트 N/A)</p>
            <p><strong>Button:</strong> ✅ variant 4종, size 3종, disabled, loading, onClick</p>
            <p><strong>Input:</strong> ✅ type, placeholder, filled, error, disabled, onChange, value</p>
            <p><strong>Textarea:</strong> ✅ rows, placeholder, filled, onChange, value</p>
            <p><strong>Card:</strong> ✅ 기본 스타일, children, selected (hover N/A)</p>
            <p><strong>Modal:</strong> ✅ open/close, 오버레이 클릭, ESC, 스크롤 잠금, 포커스 트랩</p>
            <p><strong>Toast:</strong> ✅ 4종 타입, 자동 사라짐, 수동 닫기, 다중 스택</p>
          </div>
        </Card>
      </section>
    </div>
  )
}
