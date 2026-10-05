# Agent Worlds for Locus

Local Line visualizes authorized agent activity as an ocean fleet. Selecting a
ship, opening an attention item or visiting Captain's Quarters requests an
existing native Locus surface. Locus owns profiles, chats, providers, permissions,
tasks, schedules and all execution. Rendering never starts work.

Installation identity remains `agent-world`, screen `agent-world`. This candidate
requires a Locus build implementing wire protocol 2. Older hosts reject it;
there is no automatic downgrade to protocol 1. Install through the existing Locus
Extensions review flow from a verified release artifact. Do not replace an
installed plugin directory manually. Keep the previous installed version for
rollback. User defaults and canonical chat/profile stores stay in Locus.

Everything needed for runtime rendering is bundled; no generation service,
provider credentials, CDN or network decoder is required. A missing host does not
automatically start a mock world; the separate developer harness opts into demo
state explicitly. Local Line is the only shipped world. See NOTICE and licenses/
for source attribution and unresolved derivative-artwork publication rights.
