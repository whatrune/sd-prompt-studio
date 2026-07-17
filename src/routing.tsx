import { useSyncExternalStore, type MouseEvent, type ReactNode } from 'react'

const locationListeners = new Set<() => void>()
const viteBase = import.meta.env.BASE_URL === '/' ? '' : import.meta.env.BASE_URL.replace(/\/$/, '')

function subscribeLocation(listener: () => void) {
  locationListeners.add(listener)
  window.addEventListener('popstate', listener)
  return () => {
    locationListeners.delete(listener)
    window.removeEventListener('popstate', listener)
  }
}

function locationSnapshot() {
  return `${window.location.pathname}${window.location.search}${window.location.hash}`
}

function routePathname() {
  const pathname = window.location.pathname
  if (!viteBase) return pathname
  if (pathname === viteBase) return '/'
  if (pathname.startsWith(`${viteBase}/`)) return pathname.slice(viteBase.length)
  return pathname
}

function browserPath(to: string) {
  return viteBase && to.startsWith('/') ? `${viteBase}${to}` : to
}

export function usePathname() {
  useSyncExternalStore(subscribeLocation, locationSnapshot, () => '/')
  return routePathname()
}

export function navigate(to: string, options?: { replace?: boolean }) {
  const target = browserPath(to)
  if (options?.replace) window.history.replaceState(null, '', target)
  else window.history.pushState(null, '', target)
  locationListeners.forEach(listener => listener())
}

export function AppLink({ to, children, ...props }: { to: string; children: ReactNode } & Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, 'href'>) {
  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    props.onClick?.(event)
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    event.preventDefault()
    navigate(to)
  }
  return <a {...props} href={browserPath(to)} onClick={handleClick}>{children}</a>
}
