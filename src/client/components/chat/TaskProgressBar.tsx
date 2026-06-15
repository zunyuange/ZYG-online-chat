/**
 * Task Progress Bar Component - Horizontal step indicator for task status
 */

import React from 'react';
import { TASK_STATUS_LIST, type TaskStatus } from '@shared/types';

interface TaskProgressBarProps {
  currentStatus: TaskStatus;
  onChange?: (status: TaskStatus) => void;
  editable?: boolean;
}

export function TaskProgressBar({ currentStatus, onChange, editable = false }: TaskProgressBarProps) {
  const currentIndex = TASK_STATUS_LIST.findIndex((s) => s.status === currentStatus);

  const containerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '8px 0',
    gap: '4px',
  };

  const stepContainerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    flex: 1,
    cursor: editable ? 'pointer' : 'default',
  };

  const circleStyle = (isActive: boolean, isPast: boolean): React.CSSProperties => ({
    width: '24px',
    height: '24px',
    borderRadius: '50%',
    backgroundColor: isActive ? '#1890ff' : isPast ? '#52c41a' : '#e8e8e8',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: isActive || isPast ? '#fff' : '#999',
    fontSize: '12px',
    fontWeight: 500,
    transition: 'all 0.2s ease',
  });

  const labelStyle = (isActive: boolean): React.CSSProperties => ({
    fontSize: '11px',
    color: isActive ? '#1890ff' : '#999',
    marginTop: '4px',
    textAlign: 'center',
    whiteSpace: 'nowrap',
  });

  const lineStyle = (isPast: boolean): React.CSSProperties => ({
    flex: 1,
    height: '2px',
    backgroundColor: isPast ? '#52c41a' : '#e8e8e8',
    margin: '0 2px',
    marginTop: '-16px',
    zIndex: 0,
  });

  const handleClick = (status: TaskStatus) => {
    if (editable && onChange) {
      onChange(status);
    }
  };

  return (
    <div style={containerStyle}>
      {TASK_STATUS_LIST.map((step, index) => {
        const isActive = step.status === currentStatus;
        const isPast = index < currentIndex;

        return (
          <React.Fragment key={step.status}>
            <div
              style={stepContainerStyle}
              onClick={() => handleClick(step.status)}
              role={editable ? 'button' : undefined}
              tabIndex={editable ? 0 : undefined}
              onKeyPress={(e) => {
                if (editable && (e.key === 'Enter' || e.key === ' ')) {
                  handleClick(step.status);
                }
              }}
            >
              <div style={circleStyle(isActive, isPast)}>{index + 1}</div>
              <span style={labelStyle(isActive)}>{step.label}</span>
            </div>
            {index < TASK_STATUS_LIST.length - 1 && (
              <div style={lineStyle(isPast || isActive)} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}
