import React, { useState, useEffect, useRef } from 'react';

const TerminalWidget = ({ logs = [] }) => {
  const [input, setInput] = useState('');
  const [terminalLogs, setTerminalLogs] = useState([
    { type: 'system', text: 'Kernel established. Connection secure.' },
    { type: 'warning', text: 'Minor latency detected in EU-WEST-1' }
  ]);
  const logsContainerRef = useRef(null);

  useEffect(() => {
    if (logsContainerRef.current) {
      logsContainerRef.current.scrollTop = logsContainerRef.current.scrollHeight;
    }
  }, [logs, terminalLogs]);

  const addLog = (text, type = 'info') => {
    setTerminalLogs(prev => [...prev, { type, text, timestamp: new Date().toLocaleTimeString() }]);
  };

  const processCommand = (cmd) => {
    const args = cmd.toLowerCase().trim().split(' ');
    const command = args[0];

    addLog(`> ${cmd}`, 'prompt-echo');

    switch (command) {
      case 'help':
        addLog('Available commands: help, status, whoami, clear, users, echo [msg]', 'system');
        break;
      case 'status':
        addLog('CPU: 12% | RAM: 2.4GB/8GB | UPTIME: 142h 12m', 'system');
        addLog('NETWORK: 142ms latency | API: Online', 'success');
        break;
      case 'whoami':
        addLog('USER: admin | ROLE: superuser | PERMISSIONS: all', 'system');
        break;
      case 'clear':
        setTerminalLogs([]);
        break;
      case 'users':
        addLog('ACTIVE USERS: admin, test_user, manager_01', 'system');
        break;
      case 'echo':
        addLog(args.slice(1).join(' ') || '...', 'info');
        break;
      case '':
        break;
      default:
        addLog(`Command not found: ${command}. Type 'help' for assistance.`, 'warning');
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (input.trim()) {
      processCommand(input);
      setInput('');
    }
  };

  return (
    <div className="terminal-widget">
      <div className="terminal-header">
        <span className="terminal-dot red"></span>
        <span className="terminal-dot yellow"></span>
        <span className="terminal-dot green"></span>
        <span className="terminal-title">SYS_ROOT@GRAVITY_V2</span>
      </div>
      <div className="terminal-body">
        <div className="terminal-logs" ref={logsContainerRef}>
          {/* Historical system logs first */}
          {logs.map((log, i) => (
            <div key={`sys-${i}`} className="log-entry">
              <span className="timestamp">{log?.timestamp ? new Date(log.timestamp).toLocaleTimeString() : '??:??:??'}</span>
              <span className={`action ${(log?.action || 'UNKNOWN').toLowerCase()}`}>{log?.action || 'UNKNOWN'}</span>
              <span className="user">@{log?.username || 'system'}</span>
            </div>
          ))}

          {/* Local command session logs next */}
          {terminalLogs.map((log, i) => (
            <div key={`term-${i}`} className={`log-entry ${log.type}`}>
              {log.timestamp && <span className="timestamp">{log.timestamp}</span>}
              {log.text}
            </div>
          ))}
        </div>
        <form onSubmit={handleSubmit} className="terminal-input-group">
          <span className="prompt">$</span>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type command..."
            className="terminal-input"
          />
        </form>
      </div>
    </div>
  );
};

export default TerminalWidget;
