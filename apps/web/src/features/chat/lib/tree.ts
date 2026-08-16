export interface ToolApprovalRequest {
  toolCallId: string;
  tool: string;
  input: Record<string, any> | any;
  description?: string;
  status: "pending" | "approved" | "rejected";
  reason?: string;
}

export interface MessageNode {
  id: string;
  sessionId: string;
  parentId: string | null;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt: Date | string;
  status?: "sending" | "streaming" | "complete" | "error";
  error?: string | null;
  toolApproval?: ToolApprovalRequest | null;
}

export interface BranchInfo {
  currentIndex: number;
  totalBranches: number;
  current: number;
  total: number;
  siblingIds: string[];
}

/**
 * Traverses backwards from the active leaf up to the root,
 * returning the linear active path sequence in chronological (root -> leaf) order.
 */
export function traverseActivePath(
  nodes: MessageNode[],
  activeLeafId?: string | null
): MessageNode[] {
  if (!nodes || nodes.length === 0) {
    return [];
  }

  const nodeMap = new Map<string, MessageNode>();
  for (const node of nodes) {
    nodeMap.set(node.id, node);
  }

  // Determine the starting leaf node
  let startNode: MessageNode | undefined;
  if (activeLeafId && nodeMap.has(activeLeafId)) {
    startNode = nodeMap.get(activeLeafId);
  } else {
    // Find candidate leaves: nodes that are not the parent of any other node
    const parentIdSet = new Set<string>();
    for (const node of nodes) {
      if (node.parentId) {
        parentIdSet.add(node.parentId);
      }
    }

    const leaves = nodes.filter((node) => !parentIdSet.has(node.id));
    if (leaves.length > 0) {
      // Pick the leaf with the latest createdAt
      leaves.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      startNode = leaves[0];
    } else {
      // Fallback: node with latest createdAt
      const sorted = [...nodes].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      startNode = sorted[0];
    }
  }

  if (!startNode) {
    return [];
  }

  // Traverse upwards from startNode to root
  const path: MessageNode[] = [];
  const visited = new Set<string>();
  let curr: MessageNode | undefined = startNode;

  while (curr && !visited.has(curr.id)) {
    visited.add(curr.id);
    path.push(curr);
    if (!curr.parentId) break;
    curr = nodeMap.get(curr.parentId);
  }

  return path.reverse();
}

/**
 * Computes 1-based branch index and total branches for a given message among its siblings.
 */
export function getBranchInfo(nodeId: string, nodes: MessageNode[]): BranchInfo {
  const target = nodes.find((n) => n.id === nodeId);
  if (!target) {
    return { currentIndex: 1, totalBranches: 1, current: 1, total: 1, siblingIds: [nodeId] };
  }

  // Siblings are nodes with the same parentId within the same session
  const siblings = nodes.filter(
    (n) => n.sessionId === target.sessionId && n.parentId === target.parentId
  );

  siblings.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  const siblingIds = siblings.map((s) => s.id);
  const targetIndex = siblingIds.indexOf(nodeId);
  const curr = targetIndex >= 0 ? targetIndex + 1 : 1;
  const tot = Math.max(1, siblings.length);

  return {
    currentIndex: curr,
    totalBranches: tot,
    current: curr,
    total: tot,
    siblingIds: siblingIds.length > 0 ? siblingIds : [nodeId],
  };
}

/**
 * Recursively finds all descendant node IDs of targetId and partitions
 * nodes into remainingNodes and deletedIds for cascade pruning.
 */
export function pruneSubtree(
  nodes: MessageNode[],
  targetId: string
): { remainingNodes: MessageNode[]; deletedIds: string[] } {
  const deletedSet = new Set<string>([targetId]);

  let addedMore = true;
  while (addedMore) {
    addedMore = false;
    for (const node of nodes) {
      if (node.parentId && deletedSet.has(node.parentId) && !deletedSet.has(node.id)) {
        deletedSet.add(node.id);
        addedMore = true;
      }
    }
  }

  const deletedIds = Array.from(deletedSet);
  const remainingNodes = nodes.filter((n) => !deletedSet.has(n.id));

  return { remainingNodes, deletedIds };
}

/**
 * Finds a safe new active leaf ID when a subtree has been pruned.
 */
export function findNewActiveLeafAfterPrune(
  remainingNodes: MessageNode[],
  deletedNodeParentId: string | null
): string | null {
  if (!remainingNodes || remainingNodes.length === 0) {
    return null;
  }

  if (deletedNodeParentId) {
    // Check if the parent still has other children
    const siblings = remainingNodes.filter((n) => n.parentId === deletedNodeParentId);
    if (siblings.length > 0) {
      siblings.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      // Return deepest descendant of the latest sibling
      return findDeepestDescendant(remainingNodes, siblings[0].id);
    }
    // No other children for parent: return parent itself
    return deletedNodeParentId;
  }

  // If deleted node was a root node, pick the latest remaining leaf
  const activePath = traverseActivePath(remainingNodes, null);
  return activePath.length > 0 ? activePath[activePath.length - 1].id : null;
}

export function findDeepestDescendant(nodes: MessageNode[], rootId: string): string {
  let currId = rootId;
  while (true) {
    const children = nodes.filter((n) => n.parentId === currId);
    if (children.length === 0) {
      return currId;
    }
    children.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    currId = children[0].id;
  }
}
