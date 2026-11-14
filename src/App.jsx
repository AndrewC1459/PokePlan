import { useEffect, useState } from 'react';
import WorldBackground from './components/WorldBackground.jsx';
import AccountGate from './components/AccountGate.jsx';
import TaskBoard from './components/TaskBoard.jsx';
import CalendarSidebar from './components/CalendarSidebar.jsx';
import AttackOverlay from './components/AttackOverlay.jsx';
import { installCloudSync, restoreSession } from './cloudSync.js';
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
        <span id="todayLabel" className="date-mini" />
        <button className="logout" id="logout" type="button">LOG OUT ↗</button>
      </div>
    </header>
  );
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

// Newest first. Add a new entry at the top for each update.
const UPDATES = [
  {
    version: '1.2',
    notes: [
      'Two new biomes for every partner: Sunny Shoreline, Thunder Plains, Scorched Dunes, Dragon Canyon, Lavender Graves, and Shadow Grotto.',
      'More wild Pokémon live in every biome.',
      'Up to 8 wild Pokémon roam the screen at once.',
      'Fixed the partner note getting covered when you have lots of tasks.',
    ],
  },
  { version: '1.1', notes: ['Fixed custom task bug.', 'Fixed login bug.'] },
  {
    version: '1.0',
    notes: [
      'Quest actions now say “Finish selected.”',
      'Add tasks with a custom task type.',
      'Give your Pokémon partner a nickname.',
      'Evolution moments get a pixel-art transformation animation.',
      'The calendar week runs Sunday through Saturday.',
    ],
  },
];

function UpdateNotes() {
  const [open, setOpen] = useState(false);
  const [version, setVersion] = useState(UPDATES[0].version);
  const update = UPDATES.find(u => u.version === version) || UPDATES[0];
  const openNotes = () => { setVersion(UPDATES[0].version); setOpen(true); };
  return (
    <>
      <button className="update-notes-trigger" type="button" onClick={openNotes}>UPDATES</button>
      {open && <div className="update-notes-backdrop" role="presentation" onClick={() => setOpen(false)}>
        <section className="update-notes-card" role="dialog" aria-modal="true" aria-labelledby="updateNotesTitle" onClick={event => event.stopPropagation()}>
          <button className="update-notes-close" type="button" aria-label="Close update notes" onClick={() => setOpen(false)}>×</button>
          <p className="update-notes-eyebrow">POKÉPLAN PATCH NOTES</p>
          <div className="update-notes-tabs" role="group" aria-label="Choose an update">
            {UPDATES.map(u => (
              <button key={u.version} type="button" className={u.version === update.version ? 'active' : ''}
                aria-pressed={u.version === update.version} onClick={() => setVersion(u.version)}>
                {u.version}
              </button>
            ))}
          </div>
          <h2 id="updateNotesTitle">UPDATE {update.version}</h2>
          <ul>{update.notes.map(note => <li key={note}>{note}</li>)}</ul>
          <button className="update-notes-done" type="button" onClick={() => setOpen(false)}>BACK TO QUESTS</button>
        </section>
      </div>}
    </>
  );
}

export default function App() {
  useEffect(() => {
    // Keep the established game systems intact while React owns the page/component tree.
    // Load any signed-in cloud save first so the legacy scripts open it on start.
    let cancelled = false;
    let uninstallCloud = () => {};
    const injected = [];
    restoreSession().finally(() => {
      if (cancelled) return;
      for (const source of legacyScripts) {
        const script = document.createElement('script');
        script.dataset.pokeplanLegacy = 'true';
        script.textContent = source;
        document.body.appendChild(script);
        injected.push(script);
      }
      uninstallCloud = installCloudSync();
      // The legacy scripts have now shown the right screen; reveal the page.
      document.documentElement.classList.remove('booting');
    });
    return () => {
      cancelled = true;
      uninstallCloud();
      injected.forEach(script => script.remove());
    };
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
