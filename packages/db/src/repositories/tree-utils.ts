import type { MessageNode } from "./chat-repository";

export function buildChildrenMap(nodes: MessageNode[]): Map<string | null, MessageNode[]> {
  const map = new Map<string | null, MessageNode[]>();
  for (const node of nodes) {
    const parent = node.parentId;
    if (!map.has(parent)) {
      map.set(parent, []);
    }
    map.get(parent)!.push(node);
  }
  return map;
}

export function createSessionSnippet(content: string, defaultTitle = "새로운 대화"): string {
  return content.slice(0, 30).trim() || defaultTitle;
}

export function traverseActivePath(nodes: MessageNode[], activeLeafId: string | null): MessageNode[] {
  if (!activeLeafId || nodes.length === 0) return [];

  const nodeMap = new Map<string, MessageNode>();
  for (const node of nodes) {
    nodeMap.set(node.id, node);
  }

  const path: MessageNode[] = [];
  let current: MessageNode | undefined = nodeMap.get(activeLeafId);

  while (current) {
    path.unshift(current);
    if (!current.parentId) break;
    current = nodeMap.get(current.parentId);
  }

  return path;
}

export function pruneSubtree(
  nodes: MessageNode[],
  targetNodeId: string
): { remainingNodes: MessageNode[]; deletedIds: string[] } {
  const childrenMap = buildChildrenMap(nodes);
  const deletedSet = new Set<string>();
  const queue = [targetNodeId];

  while (queue.length > 0) {
    const currId = queue.shift()!;
    deletedSet.add(currId);
    const children = childrenMap.get(currId) || [];
    for (const child of children) {
      queue.push(child.id);
    }
  }

  const deletedIds = Array.from(deletedSet);
  const remainingNodes = nodes.filter((n) => !deletedSet.has(n.id));

  return { remainingNodes, deletedIds };
}

export function findDeepestDescendant(nodes: MessageNode[], startNodeId: string): string {
  const childrenMap = buildChildrenMap(nodes);
  let currentId = startNodeId;
  while (true) {
    const children = childrenMap.get(currentId) || [];
    if (children.length === 0) break;
    const lastChild = children[children.length - 1];
    if (!lastChild) break;
    currentId = lastChild.id;
  }
  return currentId;
}

export function findNewActiveLeafAfterPrune(
  remainingNodes: MessageNode[],
  parentId: string | null
): string | null {
  if (remainingNodes.length === 0) return null;

  if (parentId) {
    const parentExists = remainingNodes.some((n) => n.id === parentId);
    if (parentExists) {
      return findDeepestDescendant(remainingNodes, parentId);
    }
  }

  const roots = remainingNodes.filter((n) => !n.parentId);
  if (roots.length > 0) {
    const lastRoot = roots[roots.length - 1];
    if (lastRoot) {
      return findDeepestDescendant(remainingNodes, lastRoot.id);
    }
  }

  const lastNode = remainingNodes[remainingNodes.length - 1];
  return lastNode ? lastNode.id : null;
}

export function resolveActiveLeafAfterPrune(
  remainingNodes: MessageNode[],
  currentActiveLeafId: string | null,
  deletedIds: string[],
  parentId: string | null
): string | null {
  const isCurrentLeafDeleted = currentActiveLeafId !== null && deletedIds.includes(currentActiveLeafId);
  if (!isCurrentLeafDeleted) {
    return currentActiveLeafId;
  }
  return findNewActiveLeafAfterPrune(remainingNodes, parentId);
}
