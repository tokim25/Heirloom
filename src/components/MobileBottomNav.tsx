import React from 'react';
import { BookOpen, CalendarDays, ShoppingBag, Plus, User as UserIcon } from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { navigate, usePath } from '../utils/router.ts';

interface MobileBottomNavProps {
  recipeCount: number;
  groceryPendingCount: number;
}

type TabId = 'recipes' | 'plan' | 'add' | 'groceries' | 'profile';

/** Which tab the current address belongs to. Overlays (Add, Profile) highlight their own tab. */
const tabForPath = (path: string): TabId => {
  if (path === '/add') return 'add';
  if (path === '/plan') return 'plan';
  if (path === '/profile') return 'profile';
  if (path === '/groceries') return 'groceries';
  return 'recipes';
};

const TAB_PATHS: Record<TabId, string> = { recipes: '/', plan: '/plan', add: '/add', groceries: '/groceries', profile: '/profile' };

/** Bottom tab bar for phones and tablets; the wider top bar takes over on large screens. */
export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({ recipeCount, groceryPendingCount }) => {
  const path = usePath();
  const { user } = useAuth();
  const active = tabForPath(path);

  const tabs: { id: TabId; label: string; badge?: number; icon: React.ReactNode }[] = [
    { id: 'recipes', label: 'Recipes', badge: recipeCount, icon: <BookOpen className="w-6 h-6" aria-hidden="true" /> },
    { id: 'plan', label: 'Plan', icon: <CalendarDays className="w-6 h-6" aria-hidden="true" /> },
    { id: 'add', label: 'Add', icon: <Plus className="w-6 h-6" aria-hidden="true" /> },
    { id: 'groceries', label: 'Groceries', badge: groceryPendingCount, icon: <ShoppingBag className="w-6 h-6" aria-hidden="true" /> },
    {
      id: 'profile',
      label: 'Profile',
      icon: user?.avatarUrl ? (
        <img src={user.avatarUrl} alt="" className="w-6 h-6 rounded-full object-cover" referrerPolicy="no-referrer" />
      ) : (
        <UserIcon className="w-6 h-6" aria-hidden="true" />
      ),
    },
  ];

  return (
    <nav
      aria-label="Main"
      className="xl:hidden fixed bottom-0 left-0 right-0 z-40 bg-canvas/95 backdrop-blur-2xl border-t border-stone-200/90 pb-[max(0.25rem,env(safe-area-inset-bottom))]"
    >
      <ul className="max-w-lg mx-auto px-2 pt-1 flex items-stretch justify-between">
        {tabs.map((tab) => {
          const isActive = tab.id === active;
          return (
            <li key={tab.id} className="flex-1">
              <button
                type="button"
                onClick={() => navigate(TAB_PATHS[tab.id])}
                aria-current={isActive ? 'page' : undefined}
                className={`w-full min-h-14 flex flex-col items-center justify-center gap-0.5 rounded-xl active:scale-95 transition-colors ${
                  isActive ? 'text-stone-950' : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                <span className={`relative flex items-center justify-center ${isActive ? 'text-amber-700 dark:text-amber-300' : ''}`}>
                  {tab.icon}
                  {tab.badge ? (
                    <span
                      className={`absolute -top-1.5 -right-3 min-w-5 h-5 px-1 rounded-full text-xs font-semibold flex items-center justify-center ${
                        isActive ? 'bg-amber-600 text-white' : 'bg-stone-200 text-stone-700'
                      }`}
                    >
                      {tab.badge > 99 ? '99+' : tab.badge}
                      <span className="sr-only"> {tab.id === 'groceries' ? 'items to buy' : 'recipes'}</span>
                    </span>
                  ) : null}
                </span>
                <span className={`text-xs ${isActive ? 'font-semibold' : 'font-medium'}`}>{tab.label}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
};
