import { FaIcon } from "../components/FaIcon";

export function AboutPage() {
  return (
    <section className="about-page">
      <div className="content-heading">
        <div>
          <p className="eyebrow">About</p>
          <h2>Company Tracker</h2>
          <p>A focused workspace for managing company targets, locations, and application progress.</p>
        </div>
      </div>

      <div className="about-grid">
        <article>
          <span><FaIcon name="building" /></span>
          <h3>Company-first workflow</h3>
          <p>Companies stay in the sidebar so selection, sorting, editing, deleting, and marking applied are always one click away.</p>
        </article>
        <article>
          <span><FaIcon name="tools" /></span>
          <h3>Management tools</h3>
          <p>Add one company with map preview, or bulk add rows when you are importing a larger target list.</p>
        </article>
        <article>
          <span><FaIcon name="chart" /></span>
          <h3>Progress analytics</h3>
          <p>Daily and overall analytics show application progress without relying on external chart packages.</p>
        </article>
      </div>
    </section>
  );
}
