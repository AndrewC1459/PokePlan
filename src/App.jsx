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

const legacyScripts = [legacy01, legacy02, legacy03, legacy04, legacy05, legacy06, legacy07,
  legacy08, legacy09, legacy10, legacy11, legacy12, legacy13, legacy14, legacy15, legacy16, legacy17, legacy18];

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

function UpdateNotes() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="update-notes-trigger" type="button" onClick={() => setOpen(true)}>UPDATE 1.0</button>
      {open && <div className="update-notes-backdrop" role="presentation" onClick={() => setOpen(false)}>
        <section className="update-notes-card" role="dialog" aria-modal="true" aria-labelledby="updateNotesTitle" onClick={event => event.stopPropagation()}>
          <button className="update-notes-close" type="button" aria-label="Close update notes" onClick={() => setOpen(false)}>×</button>
          <p className="update-notes-eyebrow">POKÉPLAN PATCH NOTES</p>
          <h2 id="updateNotesTitle">UPDATE 1.0</h2>
          <ul>
            <li>Quest actions now say “Finish selected.”</li>
            <li>Add tasks with a custom task type.</li>
            <li>Give your Pokémon partner a nickname.</li>
            <li>Evolution moments get a pixel-art transformation animation.</li>
            <li>The calendar week runs Sunday through Saturday.</li>
          </ul>
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
