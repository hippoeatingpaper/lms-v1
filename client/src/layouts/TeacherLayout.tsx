import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'
import {
  LayoutDashboard,
  Users,
  GraduationCap,
  LogOut,
} from 'lucide-react'

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: '대시보드' },
  { to: '/admin/classes', icon: GraduationCap, label: '반 관리' },
  { to: '/admin/users', icon: Users, label: '학생 관리' },
]

export function TeacherLayout() {
  const navigate = useNavigate()
  const { user, logout } = useAuthStore()

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  return (
    <div className="grid md:grid-cols-[220px_1fr] min-h-screen bg-[#F7F6F3]">
      {/* Sidebar */}
      <aside className="hidden md:flex flex-col bg-white border-r border-black/10">
        {/* Logo */}
        <div className="p-4 border-b border-black/5">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-[#534AB7] rounded-lg flex items-center justify-center">
              <span className="text-white text-sm font-medium">C</span>
            </div>
            <span className="font-medium text-[15px] text-gray-900">
              Classroom
            </span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] transition-colors ${
                  isActive
                    ? 'bg-[#EEEDFE] text-[#534AB7] font-medium'
                    : 'text-gray-600 hover:bg-gray-50'
                }`
              }
            >
              <item.icon size={18} strokeWidth={1.5} />
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* User Info & Logout */}
        <div className="p-3 border-t border-black/5">
          <div className="px-3 py-2 mb-2">
            <p className="text-[13px] font-medium text-gray-900">{user?.name}</p>
            <p className="text-[11px] text-gray-500">교사</p>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-[13px] text-gray-600 hover:bg-gray-50 transition-colors"
          >
            <LogOut size={18} strokeWidth={1.5} />
            로그아웃
          </button>
        </div>
      </aside>

      {/* Mobile Header */}
      <header className="md:hidden fixed top-0 left-0 right-0 h-14 bg-white border-b border-black/10 flex items-center justify-between px-4 z-50">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-[#534AB7] rounded-lg flex items-center justify-center">
            <span className="text-white text-xs font-medium">C</span>
          </div>
          <span className="font-medium text-[14px]">Classroom</span>
        </div>
        <button
          onClick={handleLogout}
          className="p-2 text-gray-500 hover:text-gray-700"
        >
          <LogOut size={20} strokeWidth={1.5} />
        </button>
      </header>

      {/* Main Content */}
      <main className="md:p-5 p-4 pt-18 md:pt-5">
        <Outlet />
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-white border-t border-black/10 flex items-center justify-around px-2 z-50">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg ${
                isActive ? 'text-[#534AB7]' : 'text-gray-400'
              }`
            }
          >
            <item.icon size={22} strokeWidth={1.5} />
            <span className="text-[10px]">{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
