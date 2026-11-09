import { useEffect, useState } from 'react';
import WorldBackground from './components/WorldBackground.jsx';
import AccountGate from './components/AccountGate.jsx';
import TaskBoard from './components/TaskBoard.jsx';
import CalendarSidebar from './components/CalendarSidebar.jsx';
import AttackOverlay from './components/AttackOverlay.jsx';
import './patch-notes.css';
import legacy01 from './legacy/legacy-01.js?raw';
import legacy02 from './legacy/legacy-02.js?raw';
import legacy03 from './legacy/legacy-03.js?raw';
import legacy04 from './legacy/legacy-04.js?raw';
import legacy05 from './legacy/legacy-05.js?raw';
import legacy06 from './legacy/legacy-06.js?raw';
import legacy07 from './legacy/legacy-07.js?raw';
import legacy08 from './legacy/legacy-08.js?raw';
import legacy09 from './legacy/legacy-09.js?raw';
import legacy10 from './legacy/legacy-10.js?raw';
import legacy11 from './legacy/legacy-11.js?raw';
import legacy12 from './legacy/legacy-12.js?raw';
import legacy13 from './legacy/legacy-13.js?raw';
import legacy14 from './legacy/legacy-14.js?raw';
import legacy15 from './legacy/legacy-15.js?raw';
import legacy16 from './legacy/legacy-16.js?raw';
import legacy17 from './legacy/legacy-17.js?raw';
import legacy18 from './legacy/legacy-18.js?raw';
import legacy19 from './legacy/legacy-19.js?raw';

const legacyScripts = [legacy01, legacy02, legacy03, legacy04, legacy05, legacy06, legacy07,
  legacy08, legacy09, legacy10, legacy11, legacy12, legacy13, legacy14, legacy15, legacy16, legacy17, legacy18, legacy19];

function PlannerHeader() {
  return (
    <header className="top">
      <div className="brand"><span className="brandmark">✦</span> POKÉPLAN <small>QUEST BOARD</small></div>
      <div className="topright">
        <LocalClock />
        <button className="logout" id="logout" type="button">LOG OUT ↗</button>
      </div>
    </header>
  );
}

function LocalClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const time = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit', timeZoneName: 'short' }).format(now);
  const date = new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric' }).format(now);
  return <time className="live-clock" dateTime={now.toISOString()}>{date} · {time}</time>;
}

function QuestBoardPage() {
  return (
    <div className="app hidden" id="app">
      <PlannerHeader />
      <main className="shell">
        <div className="mast">
          <div>
            <div className="eyebrow">TRAINER <span id="trainerLabel">·</span> &nbsp; / &nbsp; FIELD NOTES</div>
            <h1>YOUR QUEST BOARD</h1>
            <p>One quest at a time. You’ve got this.</p>
          </div>
          <div className="datebadge" id="dateBadge" />
        </div>
        <div className="board-layout"><TaskBoard /><CalendarSidebar /></div>
        <div className="footnote">✦ &nbsp; YOUR PARTNER BELIEVES IN YOU &nbsp; ✦</div>
      </main>
      <UpdateNotes />
    </div>
  );
}

function UpdateNotes() {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState('1.1');
  const updates = [
    { version: '1.1', date: 'November 9, 2026', title: 'PLANNER QUALITY UPDATES', notes: [
      'Custom task types accept a name you enter.',
      'Timed quests can include a start and end time.',
      'More animated Pokémon appear in the background habitats.',
      'A live clock follows your device time zone and daylight saving changes.',
      'The task list scrolls when it grows so the Pokédex fact stays visible.'
    ] },
    { version: '1.0', date: 'Previous release', title: 'THE QUEST BOARD UPDATE', notes: [
      'Quest actions say “Finish selected.”',
      'Add tasks with a custom task type.',
      'Give your Pokémon partner a nickname.',
      'Evolution moments get a pixel-art transformation animation.',
      'The calendar week runs Sunday through Saturday.'
    ] }
  ];
  const current = updates.find(update => update.version === selected) || updates[0];
  return (
    <>
      <button className="update-notes-trigger" type="button" onClick={() => setOpen(true)}>UPDATE 1.1</button>
      {open && <div className="update-notes-backdrop" role="presentation" onClick={() => setOpen(false)}>
        <section className="update-notes-card" role="dialog" aria-modal="true" aria-labelledby="updateNotesTitle" onClick={event => event.stopPropagation()}>
          <button className="update-notes-close" type="button" aria-label="Close update notes" onClick={() => setOpen(false)}>×</button>
          <p className="update-notes-eyebrow">POKÉPLAN PATCH NOTES</p>
          <div className="update-notes-layout">
            <nav className="update-version-list" aria-label="Update versions">
              {updates.map(update => <button key={update.version} type="button" className={selected === update.version ? 'active' : ''} onClick={() => setSelected(update.version)}>
                <strong>UPDATE {update.version}</strong><small>{update.date}</small>
              </button>)}
            </nav>
            <div className="update-version-content">
              <h2 id="updateNotesTitle">UPDATE {current.version}</h2>
              <p className="update-notes-date">{current.date} · {current.title}</p>
              <ul>{current.notes.map(note => <li key={note}>{note}</li>)}</ul>
            </div>
          </div>
          <button className="update-notes-done" type="button" onClick={() => setOpen(false)}>BACK TO QUESTS</button>
        </section>
      </div>}
    </>
  );
}

export default function App() {
  useEffect(() => {
    // Keep the established game systems intact while React owns the page/component tree.
    const injected = [];
    for (const source of legacyScripts) {
      const script = document.createElement('script');
      script.dataset.pokeplanLegacy = 'true';
      script.textContent = source;
      document.body.appendChild(script);
      injected.push(script);
    }
    return () => injected.forEach(script => script.remove());
  }, []);

  return (
    <>
      <WorldBackground />
      <AccountGate />
      <QuestBoardPage />
      <AttackOverlay />
    </>
  );
}
