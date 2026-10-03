import { COPY } from '../../lib/landing/copy';
import { BreakpointViews } from './breakpoint-views';
import { CodeVisual } from './code-visual';
import { DatabasePoints } from './database-points';
import { DatabaseVisual } from './database-visual';
import { EditVisual } from './edit-visual';
import { ExploreCaptions } from './explore-captions';
import { ExploreVisual } from './explore-visual';
import { FinalCta } from './final-cta';
import { FlowsVisual } from './flows-visual';
import { Hero } from './hero';
import { KnowledgeVisual } from './knowledge-visual';
import { LandingSection } from './landing-section';
import { LocalVisual } from './local-visual';
import { ProofStrip } from './proof-strip';
import { SectionText } from './section-text';

/**
 * The sododeck.com landing page (board `Sododeck Landing.dc.html`): one Checkout deck, one story
 * — generate, explore, flows, knowledge, database, code, edit, own your file. Rendered to static
 * HTML at build time; the only script is `landing-motion.ts`.
 */
export function LandingPage() {
  return (
    <>
      <Hero />
      <ProofStrip />
      <LandingSection
        id="explore"
        layout="full"
        text={<SectionText {...COPY.explore} />}
        visual={
          <BreakpointViews
            desktop={<ExploreVisual breakpoint="desktop" />}
            tablet={<ExploreVisual breakpoint="tablet" />}
            phone={<ExploreVisual breakpoint="phone" />}
          />
        }
        after={<ExploreCaptions />}
      />
      <LandingSection
        id="flows"
        layout="right"
        text={<SectionText {...COPY.flows} />}
        visual={
          <BreakpointViews
            desktop={<FlowsVisual breakpoint="desktop" />}
            tablet={<FlowsVisual breakpoint="tablet" />}
            phone={<FlowsVisual breakpoint="phone" />}
          />
        }
      />
      <LandingSection
        id="knowledge"
        layout="left"
        text={<SectionText {...COPY.knowledge} />}
        visual={
          <BreakpointViews
            desktop={<KnowledgeVisual breakpoint="desktop" />}
            tablet={<KnowledgeVisual breakpoint="tablet" />}
            phone={<KnowledgeVisual breakpoint="phone" />}
          />
        }
      />
      <div className="bg-surface-2">
        <LandingSection
          id="database"
          layout="full"
          text={<SectionText {...COPY.database} />}
          visual={
            <BreakpointViews
              desktop={<DatabaseVisual breakpoint="desktop" />}
              tablet={<DatabaseVisual breakpoint="tablet" />}
              phone={<DatabaseVisual breakpoint="phone" />}
            />
          }
          after={<DatabasePoints />}
        />
      </div>
      <LandingSection
        id="code"
        layout="right"
        text={<SectionText {...COPY.code} />}
        visual={
          <BreakpointViews
            desktop={<CodeVisual breakpoint="desktop" />}
            tablet={<CodeVisual breakpoint="tablet" />}
            phone={<CodeVisual breakpoint="phone" />}
          />
        }
      />
      <LandingSection
        id="edit"
        layout="left"
        text={<SectionText {...COPY.edit} />}
        visual={
          <BreakpointViews
            desktop={<EditVisual breakpoint="desktop" />}
            tablet={<EditVisual breakpoint="tablet" />}
            phone={<EditVisual breakpoint="phone" />}
          />
        }
      />
      <LandingSection
        id="local"
        layout="right"
        text={<SectionText {...COPY.local} />}
        visual={<LocalVisual />}
      />
      <FinalCta />
    </>
  );
}
