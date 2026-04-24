import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Card, MetricCard, Button } from '../components/ui'
import { api } from '../lib/api'
import { Users, BookOpen, FileText } from 'lucide-react'

interface ClassInfo {
  id: number
  name: string
  created_at: string
  stats: {
    student_count: number
    team_count: number
    unassigned_count: number
  }
}

interface DashboardStats {
  total_students: number
  total_classes: number
  pending_submissions: number
  recent_posts: number
}

export function Dashboard() {
  const [classes, setClasses] = useState<ClassInfo[]>([])
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadDashboardData()
  }, [])

  const loadDashboardData = async () => {
    try {
      // 반 목록 조회
      const classesData = await api<{ classes: ClassInfo[] }>('/classes')
      setClasses(classesData.classes || [])

      // 통계 계산 (실제로는 서버에서 계산해서 보내는 것이 좋음)
      const totalStudents = classesData.classes?.reduce(
        (sum, c) => sum + (c.stats?.student_count || 0),
        0
      ) || 0

      setStats({
        total_students: totalStudents,
        total_classes: classesData.classes?.length || 0,
        pending_submissions: 0, // TODO: API에서 가져오기
        recent_posts: 0, // TODO: API에서 가져오기
      })
    } catch (err) {
      console.error('Failed to load dashboard data:', err)
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
    <div className="space-y-6">
      {/* 헤더 */}
      <div>
        <h1 className="text-[18px] font-medium text-gray-900">대시보드</h1>
        <p className="text-[13px] text-gray-500 mt-1">
          전체 반 현황을 확인하세요
        </p>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard
          value={stats?.total_classes || 0}
          label="전체 반"
        />
        <MetricCard
          value={stats?.total_students || 0}
          label="전체 학생"
        />
        <MetricCard
          value={stats?.pending_submissions || 0}
          label="미제출 과제"
          highlight={stats?.pending_submissions ? 'danger' : undefined}
        />
        <MetricCard
          value={stats?.recent_posts || 0}
          label="오늘 게시글"
        />
      </div>

      {/* 반 목록 */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[15px] font-medium text-gray-900">반 목록</h2>
          <Link
            to="/admin/classes"
            className="text-[12px] text-[#534AB7] hover:underline"
          >
            전체 보기
          </Link>
        </div>

        {classes.length === 0 ? (
          <Card className="text-center py-8">
            <p className="text-[13px] text-gray-500 mb-3">
              등록된 반이 없습니다
            </p>
            <Link
              to="/admin/classes"
              className="text-[13px] text-[#534AB7] hover:underline"
            >
              반 추가하기
            </Link>
          </Card>
        ) : (
          <div className="space-y-2">
            {classes.map((classInfo) => (
              <ClassCard key={classInfo.id} classInfo={classInfo} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// 반 카드 컴포넌트
function ClassCard({ classInfo }: { classInfo: ClassInfo }) {
  // 반 이름에서 첫 글자 추출 (예: "1학년 2반" -> "1-2", "수학반" -> "수")
  const getClassLabel = (name: string) => {
    const match = name.match(/(\d+).*?(\d+)/)
    if (match) return `${match[1]}-${match[2]}`
    return name.charAt(0)
  }

  return (
    <Card className="hover:border-[#AFA9EC] transition-colors">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-[#EEEDFE] rounded-lg flex items-center justify-center">
            <span className="text-[#534AB7] font-medium text-[14px]">
              {getClassLabel(classInfo.name)}
            </span>
          </div>
          <div>
            <p className="text-[14px] font-medium text-gray-900">
              {classInfo.name}
            </p>
            <p className="text-[12px] text-gray-500">
              학생 {classInfo.stats?.student_count || 0}명 · 팀 {classInfo.stats?.team_count || 0}개
            </p>
          </div>
        </div>
      </div>
      {/* 바로가기 버튼 */}
      <div className="flex gap-2 mt-3 pt-3 border-t border-black/5">
        <Link to={`/class/${classInfo.id}/assignments`} className="flex-1">
          <Button variant="secondary" size="sm" className="w-full">
            <FileText size={14} /> 과제
          </Button>
        </Link>
        <Link to={`/class/${classInfo.id}/board`} className="flex-1">
          <Button variant="secondary" size="sm" className="w-full">
            <BookOpen size={14} /> 게시판
          </Button>
        </Link>
        <Link to={`/admin/classes/${classInfo.id}/teams`} className="flex-1">
          <Button variant="secondary" size="sm" className="w-full">
            <Users size={14} /> 팀 관리
          </Button>
        </Link>
      </div>
    </Card>
  )
}
