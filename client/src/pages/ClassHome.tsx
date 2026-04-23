import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Card, Badge } from '../components/ui'
import { api } from '../lib/api'
import { useAuthStore } from '../stores/authStore'
import { FileText, ClipboardList, ChevronRight, Clock } from 'lucide-react'

interface Post {
  id: number
  title: string
  type: 'notice' | 'material'
  created_at: string
  author_name: string
}

interface Assignment {
  id: number
  title: string
  due_date: string
  status?: 'pending' | 'submitted' | 'graded'
}

interface ClassInfo {
  id: number
  name: string
}

export function ClassHome() {
  const { classId } = useParams()
  const user = useAuthStore((s) => s.user)
  const [classInfo, setClassInfo] = useState<ClassInfo | null>(null)
  const [notices, setNotices] = useState<Post[]>([])
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (classId) {
      loadClassHomeData()
    }
  }, [classId])

  const loadClassHomeData = async () => {
    try {
      // 반 정보 조회
      const classData = await api<{ class: ClassInfo }>(`/classes/${classId}`)
      setClassInfo(classData.class)

      // 최근 공지 조회 (최대 3개)
      const postsData = await api<{ posts: Post[] }>(
        `/classes/${classId}/posts?type=notice&limit=3`
      )
      setNotices(postsData.posts || [])

      // 최근 과제 조회 (최대 3개)
      const assignmentsData = await api<{ assignments: Assignment[] }>(
        `/classes/${classId}/assignments?limit=3`
      )
      setAssignments(assignmentsData.assignments || [])
    } catch (err) {
      console.error('Failed to load class home data:', err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-2 border-[#534AB7] border-t-transparent rounded-full" />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* 환영 메시지 */}
      <div className="bg-white rounded-xl p-4 border border-black/10">
        <p className="text-[13px] text-gray-500">안녕하세요,</p>
        <p className="text-[17px] font-medium text-gray-900 mt-0.5">
          {user?.name}님
        </p>
        {classInfo && (
          <p className="text-[12px] text-gray-500 mt-1">
            {classInfo.name}
          </p>
        )}
      </div>

      {/* 공지사항 */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[15px] font-medium text-gray-900 flex items-center gap-1.5">
            <FileText size={16} className="text-[#993C1D]" />
            공지사항
          </h2>
          <Link
            to={`/class/${classId}/posts?type=notice`}
            className="text-[12px] text-[#534AB7] hover:underline"
          >
            전체 보기
          </Link>
        </div>

        {notices.length === 0 ? (
          <Card className="text-center py-6">
            <p className="text-[13px] text-gray-500">새로운 공지가 없습니다</p>
          </Card>
        ) : (
          <div className="space-y-2">
            {notices.map((notice) => (
              <NoticeCard key={notice.id} notice={notice} classId={classId!} />
            ))}
          </div>
        )}
      </section>

      {/* 진행 중인 과제 */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[15px] font-medium text-gray-900 flex items-center gap-1.5">
            <ClipboardList size={16} className="text-[#534AB7]" />
            진행 중인 과제
          </h2>
          <Link
            to={`/class/${classId}/assignments`}
            className="text-[12px] text-[#534AB7] hover:underline"
          >
            전체 보기
          </Link>
        </div>

        {assignments.length === 0 ? (
          <Card className="text-center py-6">
            <p className="text-[13px] text-gray-500">진행 중인 과제가 없습니다</p>
          </Card>
        ) : (
          <div className="space-y-2">
            {assignments.map((assignment) => (
              <AssignmentCard
                key={assignment.id}
                assignment={assignment}
                classId={classId!}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

// 공지 카드 컴포넌트
function NoticeCard({ notice, classId }: { notice: Post; classId: string }) {
  const timeAgo = getTimeAgo(notice.created_at)

  return (
    <Link to={`/class/${classId}/posts/${notice.id}`}>
      <Card className="flex items-center justify-between hover:border-[#AFA9EC] transition-colors">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="coral">공지</Badge>
            <span className="text-[11px] text-gray-400">{timeAgo}</span>
          </div>
          <p className="text-[13px] text-gray-900 truncate">{notice.title}</p>
        </div>
        <ChevronRight size={18} className="text-gray-400 flex-shrink-0 ml-2" />
      </Card>
    </Link>
  )
}

// 과제 카드 컴포넌트
function AssignmentCard({
  assignment,
  classId,
}: {
  assignment: Assignment
  classId: string
}) {
  const dueInfo = getDueInfo(assignment.due_date)
  const statusBadge = getStatusBadge(assignment.status, dueInfo.isOverdue)

  return (
    <Link to={`/class/${classId}/assignments/${assignment.id}`}>
      <Card className="flex items-center justify-between hover:border-[#AFA9EC] transition-colors">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            {statusBadge}
          </div>
          <p className="text-[13px] text-gray-900 truncate">{assignment.title}</p>
          <p className="text-[11px] text-gray-500 flex items-center gap-1 mt-1">
            <Clock size={12} />
            {dueInfo.text}
          </p>
        </div>
        <ChevronRight size={18} className="text-gray-400 flex-shrink-0 ml-2" />
      </Card>
    </Link>
  )
}

// 시간 계산 유틸리티
function getTimeAgo(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return '방금 전'
  if (diffMins < 60) return `${diffMins}분 전`
  if (diffHours < 24) return `${diffHours}시간 전`
  if (diffDays < 7) return `${diffDays}일 전`
  return date.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })
}

function getDueInfo(dueDate: string): { text: string; isOverdue: boolean } {
  const due = new Date(dueDate)
  const now = new Date()
  const diffMs = due.getTime() - now.getTime()
  const diffDays = Math.ceil(diffMs / 86400000)

  if (diffMs < 0) {
    return { text: '마감됨', isOverdue: true }
  }
  if (diffDays === 0) {
    return { text: '오늘 마감', isOverdue: false }
  }
  if (diffDays === 1) {
    return { text: '내일 마감', isOverdue: false }
  }
  if (diffDays <= 7) {
    return { text: `${diffDays}일 후 마감`, isOverdue: false }
  }
  return {
    text: due.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' }) + ' 마감',
    isOverdue: false,
  }
}

function getStatusBadge(
  status?: string,
  isOverdue?: boolean
): React.ReactNode {
  if (status === 'submitted') {
    return <Badge variant="teal">제출완료</Badge>
  }
  if (status === 'graded') {
    return <Badge variant="purple">평가완료</Badge>
  }
  if (isOverdue) {
    return <Badge variant="gray">마감됨</Badge>
  }
  return <Badge variant="amber">미제출</Badge>
}
