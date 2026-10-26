import { Children, Fragment, type ReactNode, cloneElement, isValidElement } from "react";

import { render } from "./test-render";

type AnyProps = Record<string, unknown> & { children?: ReactNode };

/**
 * Resolve async Server Components anywhere in a tree, so React Testing Library can
 * render what Next.js would stream. Not a test file (Vitest collects *.test.ts[x]).
 */
export async function resolveServerTree(node: ReactNode): Promise<ReactNode> {
  if (Array.isArray(node)) {
    return Promise.all(node.map((child) => resolveServerTree(child as ReactNode)));
  }
  if (!isValidElement<AnyProps>(node)) return node;

  const { type, props } = node;
  if (typeof type === "function" && type.constructor.name === "AsyncFunction") {
    const rendered = await (type as (p: AnyProps) => Promise<ReactNode>)(props);
    return resolveServerTree(rendered);
  }
  if (props.children === undefined) return node;
  const children = await Promise.all(
    Children.toArray(props.children).map((child) => resolveServerTree(child)),
  );
  return cloneElement(node, undefined, ...children.map((c, i) => <Fragment key={i}>{c}</Fragment>));
}

export async function renderServer(node: ReactNode | Promise<ReactNode>) {
  return render(<>{await resolveServerTree(await node)}</>);
}
