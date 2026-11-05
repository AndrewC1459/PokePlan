export default function AccountGate() {
  return (
    <div className="auth-wrap" id="authWrap">
      <section className="auth">
        <div id="accountPanel">
          <h1>POKÉPLAN<br />ADVENTURE CLUB</h1>
          <p>Your quests, your Pokémon, your little corner of the world.</p>
          <div className="auth-tabs">
            <button className="active" data-auth="signup" type="button">Create account</button>
            <button data-auth="login" type="button">Log in</button>
          </div>
          <form id="accountForm">
            <label className="field" id="nameField">Trainer name<input id="trainerName" autoComplete="nickname" maxLength="20" placeholder="What should we call you?" /></label>
            <label className="field">Email<input id="email" type="email" autoComplete="email" required placeholder="trainer@example.com" /></label>
            <label className="field">Password<input id="password" type="password" autoComplete="new-password" minLength="4" required placeholder="At least 4 characters" /></label>
            <div className="auth-error" id="authError" />
            <button className="auth-submit" id="accountSubmit">CREATE ACCOUNT →</button>
          </form>
        </div>
        <div id="starterPanel" className="hidden">
          <h1>CHOOSE YOUR PARTNER</h1>
          <p>This is your one and only starter. Choose the Pokémon you want by your side.</p>
          <div className="starter-grid" id="starterGrid" />
          <div className="starter-lock" id="starterHint">Pick the partner you want to adventure with.</div>
          <button className="auth-submit" id="lockStarter" disabled>LOCK IN MY PARTNER</button>
        </div>
      </section>
    </div>
  );
}
