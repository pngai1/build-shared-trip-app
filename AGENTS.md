# Agent entry point

For trip builds or framework changes, read `SKILL.md` first. It is the canonical workflow; follow its linked references as needed. For a fresh machine, start with `references/agent-setup.md`.

Keep this repository reusable: author real trips and generate output outside it. Never copy a real trip's Firebase configuration, private documents, credentials, or booking codes into the framework. The approved static showcase is illustrative, not an input dataset.

When updating the framework, edit `assets/app-template/`, run `npm test`, regenerate the fictional demo, and verify desktop and phone views. Do not deploy, change repository visibility, or modify a live shared trip unless the user requests that action.
