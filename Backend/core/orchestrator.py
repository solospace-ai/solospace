"""
Orchestrator: DAG topological sort, execution level grouping, cycle detection.
Extracted from main.py for testability and modularity.
"""
from typing import List, Dict, Any, Set


def sort_nodes_topologically(
    nodes: List[Dict[str, Any]], edges: List[Dict[str, Any]] = None
) -> List[Dict[str, Any]]:
    """Sort nodes using both explicit dependencies AND visual edges."""
    visited: Set[str] = set()
    sorted_nodes: List[Dict[str, Any]] = []
    node_dict = {n["id"]: n for n in nodes}

    dep_graph: Dict[str, Set[str]] = {
        n["id"]: set(n["data"].get("dependencies", [])) for n in nodes
    }
    if edges:
        for edge in edges:
            target = edge.get("target")
            source = edge.get("source")
            if target in dep_graph and source in node_dict:
                dep_graph[target].add(source)

    def visit(node_id: str):
        if node_id in visited:
            return
        visited.add(node_id)
        for dep in dep_graph.get(node_id, set()):
            if dep in node_dict:
                visit(dep)
        if node_id in node_dict:
            sorted_nodes.append(node_dict[node_id])

    for node in nodes:
        visit(node["id"])
    return sorted_nodes


def get_execution_levels(
    nodes: List[Dict[str, Any]], edges: List[Dict[str, Any]] = None
) -> List[List[str]]:
    """
    Group node IDs into dependency levels for parallel execution.
    Level 0 = no dependencies (run in parallel).
    Level N = depends only on level N-1 nodes.
    """
    all_ids = {n["id"] for n in nodes}
    dep_graph: Dict[str, Set[str]] = {}

    for n in nodes:
        deps = {d for d in n["data"].get("dependencies", []) if d in all_ids}
        dep_graph[n["id"]] = deps

    if edges:
        for edge in edges:
            target = edge.get("target")
            source = edge.get("source")
            if target in dep_graph and source in all_ids:
                dep_graph[target].add(source)

    levels: List[List[str]] = []
    completed: Set[str] = set()
    remaining: Set[str] = set(dep_graph.keys())

    while remaining:
        level = [nid for nid in remaining if dep_graph[nid].issubset(completed)]
        if not level:
            # Fallback: break deadlock (should not happen after cycle check)
            level = list(remaining)
        levels.append(level)
        completed.update(level)
        remaining -= set(level)

    return levels


def detect_cycle(
    nodes: List[Dict[str, Any]], edges: List[Dict[str, Any]] = None
) -> bool:
    """Return True if the dependency graph has a cycle."""
    all_ids = {n["id"] for n in nodes}
    graph: Dict[str, List[str]] = {
        n["id"]: [d for d in n["data"].get("dependencies", []) if d in all_ids]
        for n in nodes
    }
    if edges:
        for edge in edges:
            target = edge.get("target")
            source = edge.get("source")
            if target in graph and source in all_ids:
                graph[target].append(source)

    visited: Dict[str, bool] = {}

    def _has_cycle(node_id: str, rec_stack: Dict[str, bool]) -> bool:
        visited[node_id] = True
        rec_stack[node_id] = True
        for neighbor in graph.get(node_id, []):
            if not visited.get(neighbor, False):
                if _has_cycle(neighbor, rec_stack):
                    return True
            elif rec_stack.get(neighbor, False):
                return True
        rec_stack[node_id] = False
        return False

    for node_id in graph:
        if not visited.get(node_id, False):
            if _has_cycle(node_id, {}):
                return True
    return False


def validate_dependencies(
    nodes: List[Dict[str, Any]],
) -> List[str]:
    """
    Returns a list of validation error strings.
    Empty list = valid graph.
    """
    errors = []
    all_ids = {n["id"] for n in nodes}
    for node in nodes:
        if not node.get("data", {}).get("enabled", True):
            continue
        for dep in node.get("data", {}).get("dependencies", []):
            if dep not in all_ids:
                errors.append(
                    f"Agent '{node['id']}' depends on missing agent '{dep}'"
                )
    return errors
