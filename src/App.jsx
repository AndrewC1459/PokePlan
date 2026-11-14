import { useEffect, useState } from 'react';
import WorldBackground from './components/WorldBackground.jsx';
import AccountGate from './components/AccountGate.jsx';
import TaskBoard from './components/TaskBoard.jsx';
import CalendarSidebar from './components/CalendarSidebar.jsx';
import AttackOverlay from './components/AttackOverlay.jsx';
import { installCloudSync, restoreSession } from './cloudSync.js';
import * as schedule from './planner/schedule.js';
import { mergeSaves } from './planner/merge.js';

// The game systems still run as classic scripts sharing globals, loaded in file-name order.
// legacy-01 is the core (accounts, quests, calendar, XP); later files add scenery and polish.
const legacyScripts = Object.entries(import.meta.glob('./legacy/*.js', { query: '?raw', import: 'default', eager: true }))
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([path, source]) => ({ name: path.split('/').pop(), source }));

function PlannerHeader() {
  return (
    <header className="top">
      <div className="brand"><span className="brandmark">✦</span> POKÉPLAN <small>QUEST BOARD</small></div>
      <div className="topright">
        <span id="todayLabel" className="date-mini" />
        <button className="name-edit" type="button">EDIT NAME</button>
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
            <div className="eyebrow">TRAINER <span id="trainerLabel">·</span> &nbsp; / &nbsp; DAILY PLAN</div>
            <h1>FIELD NOTES</h1>
            <p>A little progress, one day at a time.</p>
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
    version: '1.3',
    notes: [
      'Undo: finished or deleted a quest by mistake? Press UNDO on the message that pops up (or Ctrl+Z).',
      'Repeating quests: set a quest to repeat every day, on weekdays, every week, or every month.',
      'Deleting a repeating quest lets you skip just that day or stop it repeating.',
      'Saves from different devices now combine instead of overwriting each other, and coming back to the tab loads your latest progress.',
      'The background animation runs much more smoothly and uses far less battery.',
      'Pokémon sprites now load from Poképlan itself, so they keep working even if outside sites change.',
      'Fixed quests with the same name sometimes showing each other’s badges, and quest times showing twice.',
    ],
  },
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
      window.PlannerLogic = { ...schedule, mergeSaves };
      for (const { name, source } of legacyScripts) {
        const script = document.createElement('script');
        script.dataset.pokeplanLegacy = 'true';
        // Name each script so errors and stack traces point at the right file.
        script.textContent = `${source}\n//# sourceURL=${name}`;
        document.body.appendChild(script);
        injected.push(script);
      }
      // Cloud saving must be in place before the saved session opens (opening can save).
      uninstallCloud = installCloudSync();
      window.bootPlanner();
      // The scripts have now shown the right screen; reveal the page.
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
