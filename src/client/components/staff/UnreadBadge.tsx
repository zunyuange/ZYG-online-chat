/**
 * Unread Badge Component - Shows unread count
 */

interface UnreadBadgeProps {
  count: number;
  max?: number;
}

export function UnreadBadge({ count, max = 99 }: UnreadBadgeProps) {
  if (count === 0) return null;

  const displayCount = count > max ? `${max}+` : count;

  const style: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: '18px',
    height: '18px',
    padding: '0 6px',
    backgroundColor: '#ff4d4f',
    color: '#fff',
    fontSize: '12px',
    fontWeight: 500,
    borderRadius: '9px',
    position: 'absolute',
    top: '-4px',
    right: '-4px',
  };

  return <span style={style}>{displayCount}</span>;
}