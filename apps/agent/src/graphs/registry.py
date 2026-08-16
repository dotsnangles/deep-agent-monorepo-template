from collections.abc import Callable
from typing import Any

from langgraph.checkpoint.base import BaseCheckpointSaver
from langgraph.graph.state import CompiledStateGraph

from src.graphs.chat import build_agent, build_hitl_agent_graph

GraphFactory = Callable[..., CompiledStateGraph]


class GraphRegistry:
    """Registry managing compilable LangGraph StateGraph definitions and routing by agent_type."""

    def __init__(self):
        self._factories: dict[str, GraphFactory] = {}
        self._register_defaults()

    def _register_defaults(self):
        """Registers default built-in graph factories."""
        self.register("default", build_hitl_agent_graph)
        self.register("chat", build_hitl_agent_graph)
        self.register("hitl", build_hitl_agent_graph)
        self.register("deep_agent", build_agent)

    def register(self, agent_type: str, factory: GraphFactory) -> None:
        """Registers a graph factory function for the given agent_type."""
        self._factories[agent_type.lower().strip()] = factory

    def has_graph(self, agent_type: str) -> bool:
        """Checks if a graph factory is registered for agent_type."""
        return agent_type.lower().strip() in self._factories

    def list_graphs(self) -> list[str]:
        """Returns list of registered graph types."""
        return list(self._factories.keys())

    def get_graph(
        self,
        agent_type: str = "default",
        checkpointer: BaseCheckpointSaver | None = None,
        store: Any = None,
        model: Any = None,
        **kwargs: Any,
    ) -> CompiledStateGraph:
        """Resolves and compiles the graph for the given agent_type."""
        key = agent_type.lower().strip()
        factory = self._factories.get(key)
        if not factory:
            factory = self._factories.get("default", build_hitl_agent_graph)

        call_kwargs: dict[str, Any] = {
            "checkpointer": checkpointer,
            "store": store,
            **kwargs,
        }
        if model is not None:
            call_kwargs["model"] = model

        try:
            return factory(**call_kwargs)
        except TypeError:
            # Fallback if factory accepts only basic parameters
            return factory(checkpointer=checkpointer, store=store)


# Global default graph registry singleton
global_graph_registry = GraphRegistry()
