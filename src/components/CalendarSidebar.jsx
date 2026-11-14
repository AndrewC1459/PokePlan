export function Calendar() {
  return (
    <>
      <div className="side-top">
        <h2>CALENDAR</h2>
        <div className="zoom">
          <button data-view="day" type="button">DAY</button>
          <button data-view="week" className="active" type="button">WEEK</button>
          <button data-view="month" type="button">MONTH</button>
        </div>
      </div>
      <div className="cal-nav">
        <button className="arrow" id="prev" type="button" aria-label="Previous period">◀</button>
        <strong id="monthName" />
        <button className="arrow" id="next" type="button" aria-label="Next period">▶</button>
      </div>
      <div className="week" aria-hidden="true">
        <span>SU</span><span>MO</span><span>TU</span><span>WE</span><span>TH</span><span>FR</span><span>SA</span>
      </div>
      <div className="calgrid" id="calendar" />
      <div className="cal-foot"><span>OPEN QUESTS</span><strong id="weekCount">0</strong></div>
    </>
  );
}

export function PartnerCard() {
  return (
    <div className="companion">
      <div className="comp-title">PARTNER</div>
      <div className="comp-row">
        <img className="comp-sprite" id="miniPokemon" alt="" />
        <div className="comp-name-wrap"><div className="comp-name" id="companionName" /><div className="comp-lock">Starter · bonded</div></div>
        <button className="nickname-button" id="nicknamePartner" type="button" aria-label="Set partner nickname">✎</button>
        <span className="starter-badge">♥ LOCKED</span>
      </div>
      <div className="terrain-note" id="terrainNote" />
      <div className="xp-box">
        <div className="xp-top"><span id="xpLevel">LV. 1</span><span id="xpPoints">0 / 100 XP</span></div>
        <div className="xp-track"><i id="xpFill" /></div>
      </div>
    </div>
  );
}

export default function CalendarSidebar() {
  return <aside className="side"><Calendar /><PartnerCard /></aside>;
}
