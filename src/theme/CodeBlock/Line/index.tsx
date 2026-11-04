import type {CSSProperties, ReactNode} from 'react';
import type {Props} from '@theme/CodeBlock/Line';
import Line from '@theme-original/CodeBlock/Line';

/** Passes the line's indentation to the stylesheet, so a wrapped line continues one indent further than its own start. */
export default function LineWrapper(props: Props): ReactNode {
  const indent = /^ */.exec(props.line.map(token => token.content).join(''))?.[0].length ?? 0;
  const getLineProps: Props['getLineProps'] = input => {
    const lineProps = props.getLineProps(input);
    return {...lineProps, style: {...lineProps.style, '--indent': `${indent}ch`} as CSSProperties};
  };
  return <Line {...props} getLineProps={getLineProps} />;
}
