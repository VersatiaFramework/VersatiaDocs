import type {ReactNode} from 'react';
import clsx from 'clsx';
import DefaultAdmonitionTypes from '@theme-original/Admonition/Types';
import AdmonitionLayout from '@theme/Admonition/Layout';
import type {Props} from '@theme/Admonition';
import {AudienceIcon, type Who} from '@site/src/components/Audience/icons';

const TITLES: Record<Who, string> = {admin: 'For server admins', developer: 'For plugin developers'};

/** `:::admin` and `:::developer`: what one audience has to know, in its own colour; the keywords are registered in docusaurus.config.ts. */
function audienceAdmonition(who: Who) {
  return function AudienceAdmonition(props: Props): ReactNode {
    return (
      <AdmonitionLayout
        {...props}
        icon={<AudienceIcon who={who} className="versatia-audience-icon" />}
        title={props.title ?? TITLES[who]}
        className={clsx('alert', `alert--${who}`, props.className)}>
        {props.children}
      </AdmonitionLayout>
    );
  };
}

export default {
  ...DefaultAdmonitionTypes,
  admin: audienceAdmonition('admin'),
  developer: audienceAdmonition('developer'),
};
