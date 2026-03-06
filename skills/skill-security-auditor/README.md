# Skill Security Auditor

A security validation skill for AI agents. It analyzes other downloaded skills, AI-generated scripts, or workspace files for potential malicious intent, prompt injection, and obfuscation. It acts as a crucial safety layer before executing untrusted code or integrating third-party agent skills into your workflows.

## Features

The included `check_ascii.py` script scans target files and directories for:

1.  **Dangerous Keywords:** Detects execution commands (`eval`, `exec`, `os.system`, `subprocess`) and network commands (`curl`, `wget`).
2.  **Prompt Injection:** Identifies common phrasing designed to override agent instructions (e.g., "ignore previous instructions", "bypass safeguards").
3.  **Network Extrusion:** Flags IP addresses and suspicious TLDs/tunnels (like `.ru`, `ngrok.io`, `serveo.net`) that might be used as Command & Control (C2) servers.
4.  **Obfuscation:** Discovers large contiguous blocks of Base64 strings (>200 characters) often used to hide payloads.
5.  **Invalid Encodings:** Alerts on files containing invalid UTF-8 byte sequences, a common trait of binary malware or extreme obfuscation.
6.  **Invisible/Ambiguous Characters:** Finds non-printable or non-standard ASCII characters (like zero-width spaces) that could be used to manipulate parsing.

## Installation

Install via [skills.sh](https://skills.sh):

```bash
npx skills add <your-github-repo-url-here>
```

This will install the skill into your project's `.agents/skills` directory.

## Usage

To validate a skill or a specific script, ask your AI agent to run the auditor, or manually run the python script from your terminal:

```bash
python .agents/skills/skill-security-auditor/scripts/check_ascii.py <path_to_skill_directory_or_file>
```

**Example:**
```bash
python .agents/skills/skill-security-auditor/scripts/check_ascii.py .agents/skills/some-untrusted-skill
```

### Interpreting Results

-   If the script outputs `Validation passed. No malicious signs found...`, the target is mostly safe.
-   If the script outputs `[WARNING]` or `[ALERT]`, **do not execute** the target code automatically. Review the flagged lines carefully to verify if it is a false positive (e.g., a legitimate use of `subprocess`) or an actual threat.
