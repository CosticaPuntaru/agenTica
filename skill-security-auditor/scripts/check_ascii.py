import sys
import os
import string
import re

# Characters that are almost always safe (ASCII printable, plus basic controls)
SAFE_CHARS = set(string.printable) | {chr(9), chr(10), chr(13)}

# High Risk Keywords
SUSPICIOUS_KEYWORDS = {
    b'eval(': 'Execution', b'exec(': 'Execution', b'os.system(': 'Execution', 
    b'subprocess.': 'Execution', b'__import__(': 'Execution', 
    b'child_process.exec': 'Execution', b'require("child_process")': 'Execution', 
    b'curl ': 'Network', b'wget ': 'Network', b'nc -e': 'Network', b'bash -i': 'Execution', 
    b'rm -rf /': 'Destructive', b'base64.b64decode': 'Obfuscation', b'atob(': 'Obfuscation'
}

# Prompt injection phrases
PROMPT_INJECTION_PHRASES = [
    b'ignore all previous', b'ignore previous instructions',
    b'override system instructions', b'disregard previous instructions',
    b'system prompt override', b'you are now', b'forget your original',
    b'bypass safeguards'
]

IP_PATTERN = re.compile(rb'\b(?:[0-9]{1,3}\.){3}[0-9]{1,3}\b')
SUSPICIOUS_DOMAIN_PATTERN = re.compile(rb'(?:https?://)?(?:[a-zA-Z0-9-]+\.)*(?:ngrok\.io|localtunnel\.me|serveo\.net|[a-zA-Z0-9-]+\.(?:ru|su|tk|cn))\b')
BASE64_PATTERN = re.compile(b'[A-Za-z0-9+/=]{200,}')

def check_chars(path):
    if os.path.isfile(path):
        files_to_check = [path]
    elif os.path.isdir(path):
        files_to_check = []
        for root, dirs, files in os.walk(path):
            for file in files:
                filepath = os.path.join(root, file)
                if any(part.startswith('.') for part in filepath.split(os.sep) if part not in ['.', '..']):
                    continue
                if filepath.endswith('.pyc') or filepath.endswith('.png') or filepath.endswith('.jpg'):
                    continue
                files_to_check.append(filepath)
    else:
        print(f"Path not found: {path}")
        return False

    findings = []

    for filepath in files_to_check:
        try:
            with open(filepath, 'rb') as f:
                raw_content = f.read()

            for keyword, ktype in SUSPICIOUS_KEYWORDS.items():
                if keyword in raw_content:
                    findings.append({'risk': 'HIGH', 'file': filepath, 'type': 'Dangerous Keyword', 'detail': f"Keyword: {keyword.decode('utf-8', errors='ignore')}"})

            for phrase in PROMPT_INJECTION_PHRASES:
                if phrase.lower() in raw_content.lower():
                    findings.append({'risk': 'HIGH', 'file': filepath, 'type': 'Prompt Injection', 'detail': f"Phrase: {phrase.decode('utf-8', errors='ignore')}"})

            for match in IP_PATTERN.finditer(raw_content):
                ip = match.group().decode('utf-8', errors='ignore')
                if ip not in ['127.0.0.1', '0.0.0.0', '255.255.255.255']:
                    findings.append({'risk': 'MEDIUM', 'file': filepath, 'type': 'Network Extrusion (IP)', 'detail': f"IP: {ip}"})
            
            for match in SUSPICIOUS_DOMAIN_PATTERN.finditer(raw_content):
                domain = match.group().decode('utf-8', errors='ignore')
                findings.append({'risk': 'HIGH', 'file': filepath, 'type': 'Suspicious Domain/Tunnel', 'detail': f"Domain: {domain}"})

            for match in BASE64_PATTERN.finditer(raw_content):
                findings.append({'risk': 'HIGH', 'file': filepath, 'type': 'Potential Obfuscation', 'detail': f"Base64 Payload (length {len(match.group())})"})

            try:
                content = raw_content.decode('utf-8')
                count_newlines = 0
                for i, char in enumerate(content):
                    if char == '\n':
                        count_newlines += 1
                    elif char not in SAFE_CHARS:
                        findings.append({'risk': 'LOW', 'file': filepath, 'type': 'Suspicious Character', 'detail': f"Line {count_newlines + 1}: Unicode/invisible {repr(char)} ({hex(ord(char))})"})
            except UnicodeDecodeError:
                findings.append({'risk': 'LOW', 'file': filepath, 'type': 'Encoding', 'detail': "Not valid UTF-8 (Could be binary or obfuscated)"})

        except Exception as e:
            findings.append({'risk': 'LOW', 'file': filepath, 'type': 'File Error', 'detail': f"Could not read file: {e}"})

    # Generate Report
    print("=" * 60)
    print(" " * 15 + "SECURITY AUDIT REPORT")
    print("=" * 60)

    if not findings:
        print("\n\033[92m[SAFE] Validation passed. No malicious signs found in target.\033[0m\n")
        return True

    risk_counts = {'HIGH': 0, 'MEDIUM': 0, 'LOW': 0}
    for f in findings:
        risk_counts[f['risk']] += 1

    overall_risk = "SAFE"
    if risk_counts['HIGH'] > 0:
        overall_risk = "CRITICAL"
        color = "\033[91m"
    elif risk_counts['MEDIUM'] > 0:
        overall_risk = "ELEVATED"
        color = "\033[93m"
    else:
        overall_risk = "LOW"
        color = "\033[94m"

    print(f"\nOVERALL RISK LEVEL: {color}{overall_risk}\033[0m")
    print(f"Summary: {risk_counts['HIGH']} High, {risk_counts['MEDIUM']} Medium, {risk_counts['LOW']} Low\n")

    print("-" * 60)
    print("FINDINGS:")
    print("-" * 60)
    
    # Sort findings by risk level (HIGH > MEDIUM > LOW)
    risk_order = {'HIGH': 0, 'MEDIUM': 1, 'LOW': 2}
    findings.sort(key=lambda x: (risk_order[x['risk']], x['file']))

    for f in findings:
        rcolor = ""
        if f['risk'] == 'HIGH': rcolor = "\033[91m"
        elif f['risk'] == 'MEDIUM': rcolor = "\033[93m"
        elif f['risk'] == 'LOW': rcolor = "\033[94m"
        
        print(f"{rcolor}[{f['risk']}]\033[0m {f['type']} -> {f['file']}")
        print(f"       Details: {f['detail']}\n")

    return risk_counts['HIGH'] == 0

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python check_ascii.py <directory_or_file>")
        sys.exit(1)
    
    success = check_chars(sys.argv[1])
    sys.exit(0 if success else 1)
