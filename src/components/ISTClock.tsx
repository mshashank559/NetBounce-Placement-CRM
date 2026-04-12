import React, { useEffect, useState } from 'react';

const ISTClock: React.FC = () => {
  const [time, setTime] = useState('');

  useEffect(() => {
    const update = () => {
      const now = new Date();
      const ist = new Intl.DateTimeFormat('en-IN', {
        timeZone: 'Asia/Kolkata',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
      }).format(now);
      setTime(ist);
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex items-center gap-2 text-sm font-mono text-muted-foreground">
      <span className="text-xs text-muted-foreground/60">IST</span>
      <span className="font-medium">{time}</span>
    </div>
  );
};

export default ISTClock;
