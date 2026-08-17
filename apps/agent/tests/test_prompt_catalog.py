from pathlib import Path

from src.graphs.chat.prompts import PromptCatalog


def test_prompt_catalog_fallback_when_empty():
    """Verify PromptCatalog falls back to built-in constants when directory is empty."""
    catalog = PromptCatalog(prompts_dir=Path("/non_existent_prompts_dir"))
    system_prompt = catalog.get_system_prompt()
    assert "You are an expert autonomous Deep Agent" in system_prompt

    title_prompt = catalog.get_title_prompt()
    assert title_prompt is not None


def test_prompt_catalog_load_custom_markdown(tmp_path: Path):
    """Verify PromptCatalog loads custom markdown files."""
    prompts_dir = tmp_path / "prompts"
    prompts_dir.mkdir()

    (prompts_dir / "system_prompt.md").write_text(
        "Custom Persona for {name}. Always assist with precision.",
        encoding="utf-8",
    )
    (prompts_dir / "title_prompt.md").write_text(
        "Generate 3-word title in Korean.",
        encoding="utf-8",
    )
    (prompts_dir / "rubric.md").write_text(
        "Grade strictly for code quality.",
        encoding="utf-8",
    )

    catalog = PromptCatalog(prompts_dir=prompts_dir, debug=False)

    # 1. System Prompt with variable substitution
    sys_prompt = catalog.get_system_prompt(name="MockPersona")
    assert sys_prompt == "Custom Persona for MockPersona. Always assist with precision."

    # 2. Title Prompt
    title_prompt = catalog.get_title_prompt()
    assert title_prompt is not None

    # 3. Rubric Prompt
    rubric = catalog.get_rubric_prompt()
    assert rubric == "Grade strictly for code quality."


def test_prompt_catalog_safe_formatting():
    """Verify format_template handles missing keys without throwing KeyError."""
    catalog = PromptCatalog()
    template = "Hello {name}, your score is {score}% and json is {'key': 123}."
    result = catalog.format_template(template, name="Alice")
    assert "Hello Alice" in result
    assert "{score}%" in result
    assert "{'key': 123}" in result


def test_prompt_catalog_hot_reloading(tmp_path: Path):
    """Verify debug=True reloads on file modification, debug=False caches."""
    prompts_dir = tmp_path / "prompts"
    prompts_dir.mkdir()
    sys_file = prompts_dir / "system_prompt.md"

    sys_file.write_text("V1 Prompt", encoding="utf-8")

    # Debug = True (Dynamic)
    catalog_dev = PromptCatalog(prompts_dir=prompts_dir, debug=True)
    assert catalog_dev.get_system_prompt() == "V1 Prompt"

    sys_file.write_text("V2 Modified Prompt", encoding="utf-8")
    assert catalog_dev.get_system_prompt() == "V2 Modified Prompt"

    # Debug = False (Cached)
    catalog_prod = PromptCatalog(prompts_dir=prompts_dir, debug=False)
    assert catalog_prod.get_system_prompt() == "V2 Modified Prompt"

    sys_file.write_text("V3 Modified Prompt", encoding="utf-8")
    assert catalog_prod.get_system_prompt() == "V2 Modified Prompt"
