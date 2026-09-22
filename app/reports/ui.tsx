import './reports.css';

export function iconSvg(kind: 'pass' | 'fail' | 'unknown') {
    if (kind === 'pass') {
        return (
            <svg className="icon" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
                <circle cx="8" cy="8" r="7" fill="currentColor" opacity="0.15" />
                <path d="M4.6 8.4l2.4 2.4 4.4-5.2" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
        );
    }
    if (kind === 'fail') {
        return (
            <svg className="icon" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
                <circle cx="8" cy="8" r="7" fill="currentColor" opacity="0.15" />
                <path d="M5.5 5.5l5 5M10.5 5.5l-5 5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
        );
    }
    return (
        <svg className="icon" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
            <circle cx="8" cy="8" r="7" fill="currentColor" opacity="0.15" />
            <path d="M6.2 6.2a1.8 1.8 0 1 1 2.6 1.6c-.6.3-.8.6-.8 1.2" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <circle cx="8" cy="11.4" r="0.9" fill="currentColor" />
        </svg>
    );
}

export function statusChip(status: string) {
    if (!status) return null;
    return status === 'PASS' ? (
        <span className="chip pass" aria-label="Superato">PASS</span>
    ) : (
        <span className="chip fail" aria-label="Fallito">FAIL</span>
    );
}

export function statusIcon(status: string) {
    const kind = status === 'PASS' ? 'pass' : status === 'FAIL' ? 'fail' : 'unknown';
    return <span className={`status-icon ${kind}`}>{iconSvg(kind as 'pass' | 'fail' | 'unknown')}</span>;
}
