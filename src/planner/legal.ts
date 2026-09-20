import type { DocSection, PlannerBrief } from "./types";
import { deployPhrase } from "./content";

function todayLong(iso: string) {
  const d = new Date(iso.slice(0, 10) + "T12:00:00");
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

export function buildNda(
  product: string,
  client: string,
  vendor: string,
  brief: PlannerBrief,
  generatedAt: string
): DocSection[] {
  const date = todayLong(generatedAt);
  const industry = brief.industry.trim() || "the relevant";
  return [
    {
      heading: "0. Drafting box (search [ ] in Word)",
      body: "This is a mutual non-disclosure agreement in the form used for RFP and pre-contract discussions. It is a first draft for counsel, not an executed deed. Yellow items in square brackets must be completed or struck before signature. Electronic signature is intended to be valid under UAE Federal Decree-Law No. 46 of 2021 on Electronic Transactions and Trust Services, unless a party requires wet ink.",
      table: {
        caption: "Edit list — do not leave brackets in an executed copy",
        headers: ["Mark", "Default in this draft", "Who decides"],
        rows: [
          ["[ADDRESS]", "Registered office of each party", "Company secretary"],
          ["[TRADE LICENCE]", "Blank", "Each party"],
          ["[TERM]", "Three (3) years from last disclosure; trade secrets until they cease to be secret", "Counsel"],
          ["[GOVERNING LAW]", "UAE law; Courts of Dubai (onshore). Strike and insert DIFC or ADGM if agreed", "Counsel / procurement"],
          ["[RESIDUALS]", "Clause 12 is optional. Delete for most government issuers", "Client legal"],
          ["[PENALTY]", "No liquidated damages. Injunctive relief only", "Counsel"],
        ],
      },
    },
    {
      heading: "Parties",
      body: `This Mutual Non-Disclosure Agreement (the “Agreement”) is made on ${date} (or the date of last signature, if later) between:`,
      numbered: [
        `${client}, a [legal form] organised under the laws of the United Arab Emirates, with registered office at [ADDRESS] and trade licence [NUMBER] (the “First Party”); and`,
        `${vendor}, a [legal form] organised under the laws of [JURISDICTION], with registered office at [ADDRESS] and trade licence / commercial registration [NUMBER] (the “Second Party”).`,
      ],
      paragraphs: [
        "Each is a “Party” and together the “Parties”. Affiliates of a Party that receive Confidential Information under clause 5 are bound as if they had signed. An “Affiliate” is an entity that Controls, is Controlled by, or is under common Control with a Party, where Control means the power to direct management, whether by voting rights, contract, or otherwise.",
        `The Purpose of disclosure is the evaluation, bidding, negotiation and (if awarded) delivery of ${product} for ${industry} operations, including related workshops, site visits, and RFP responses (the “Purpose”). Use for any other purpose is a breach.`,
      ],
    },
    {
      heading: "Recitals",
      body: "The recitals form part of this Agreement.",
      numbered: [
        "The Parties wish to exchange information that is confidential, commercially sensitive, or personal, in order to pursue the Purpose.",
        "Each Party is willing to disclose and to receive such information only on the terms of this Agreement.",
        "This Agreement is mutual. Obligations apply to whichever Party is the Discloser or the Recipient in respect of a given item of information.",
        "Nothing in this Agreement obliges either Party to proceed to a supply contract. A later master services agreement and statement of work, if signed, sit alongside this Agreement and do not reduce its survival unless they expressly vary it.",
      ],
    },
    {
      heading: "1. Definitions and interpretation",
      body: "In this Agreement, unless the context requires otherwise:",
      table: {
        caption: "Defined terms",
        headers: ["Term", "Meaning"],
        rows: [
          ["Confidential Information", "All information (in any form, including oral, visual, electronic, models, software, and samples) relating to a Party or its Affiliates, customers, suppliers, or the Purpose, that is disclosed by or on behalf of the Discloser, or that the Recipient obtains in connection with the Purpose, and that is marked confidential or that a reasonable person would understand to be confidential given its nature or the circumstances of disclosure. It includes the fact and terms of discussions, bid prices, technical designs, personal data, security architecture, and this Agreement."],
          ["Discloser", "The Party disclosing Confidential Information (or on whose behalf it is disclosed)."],
          ["Recipient", "The Party receiving Confidential Information."],
          ["Representatives", "A Party’s and its Affiliates’ officers, employees, professional advisers, and subcontractors who need the information for the Purpose and who are bound by written confidentiality no less strict than this Agreement."],
          ["Personal Data", "Any data relating to an identified or identifiable natural person, including as defined in UAE Federal Decree-Law No. 45 of 2021 (PDPL)."],
        ],
      },
      paragraphs: [
        "Headings are for convenience only. “Including” means “including without limitation”. A reference to a statute includes all subordinate legislation and amendments. If a translation is prepared, the English text prevails unless a government Party requires Arabic to prevail — in which case insert that sentence here and obtain a certified translation before execution.",
      ],
    },
    {
      heading: "2. Confidential Information — inclusions",
      body: "Without limiting the definition, Confidential Information includes:",
      bullets: [
        `Business and operational information of ${client}, including SOPs, volumes, organisation charts, and RFP evaluation scores.`,
        `Technical information of ${vendor} relating to ${product}, including architecture, source, object, APIs, threat models, and pricing build-up.`,
        "Personal Data of staff, applicants, or customers observed during workshops or in sample files.",
        "Site layouts, rack diagrams, firewall rules, and credentials, even if not marked.",
        "All notes, analyses, and compilations prepared by the Recipient that contain or reflect the foregoing.",
      ],
    },
    {
      heading: "3. Exclusions",
      body: "Confidential Information does not include information that the Recipient can prove:",
      numbered: [
        "is or becomes public other than by a breach of this Agreement;",
        "was lawfully in the Recipient’s possession without a confidentiality duty before disclosure;",
        "is independently developed by the Recipient without use of the Discloser’s information (contemporaneous records required); or",
        "is received from a third party who is not, to the Recipient’s knowledge after reasonable enquiry, in breach of a duty to the Discloser.",
      ],
      paragraphs: [
        "The exclusions do not apply to Personal Data merely because it is also held in another database. Combination of public items that reveals a non-public fact remains confidential.",
      ],
    },
    {
      heading: "4. Obligations of the Recipient",
      body: "The Recipient shall:",
      numbered: [
        "use Confidential Information solely for the Purpose;",
        "keep it secret using at least the same degree of care it uses for its own equivalent information, and in no case less than reasonable care;",
        "not copy except as needed for the Purpose;",
        "not reverse engineer software or samples except to the extent mandatory law cannot be waived;",
        "not file a patent or similar right that uses the Discloser’s information;",
        "limit access to Representatives who have a need to know;",
        "be responsible for its Representatives as for itself;",
        "notify the Discloser in writing without undue delay, and in any event within forty-eight (48) hours, after becoming aware of a suspected unauthorised use, disclosure, or loss; and",
        "cooperate, at the Discloser’s reasonable cost except where the Recipient is at fault, in any mitigation.",
      ],
    },
    {
      heading: "5. Permitted disclosures",
      body: "The Recipient may disclose Confidential Information:",
      numbered: [
        "to Representatives for the Purpose;",
        "to a regulator, court, or stock exchange to the extent required by law, provided that (where lawful) the Recipient gives the Discloser prompt prior notice and reasonable assistance to seek a protective order, and discloses only what is required; and",
        "with the Discloser’s prior written consent.",
      ],
      paragraphs: [
        "A disclosure under a UAE, DIFC, or ADGM production order, or a Central Bank / SCA / TDRA information request, is permitted if the procedure above is followed. The Recipient shall still mark the production as confidential where the forum allows.",
      ],
    },
    {
      heading: "6. Personal Data",
      body: `If Confidential Information includes Personal Data, the Recipient is a processor or controller only as the facts require. Pending a data-processing addendum, the Recipient shall not process Personal Data except as strictly necessary for the Purpose, shall not transfer it outside the United Arab Emirates without ${client === "the Client" ? "the Discloser" : client}’s written instruction (or the Discloser’s, as applicable), shall implement appropriate technical and organisational measures, and shall delete or return it when the Purpose ends unless UAE law requires retention.`,
      paragraphs: [
        "Sample production data must be masked or synthetic unless the Discloser issues a written instruction otherwise. Screenshots of production UIs with live names are Confidential Information and Personal Data.",
      ],
    },
    {
      heading: "7. No licence, no warranty, no obligation to deal",
      body: "All Confidential Information remains the Discloser’s property. No licence under copyright, patent, trademark, or other right is granted except the limited right to use for the Purpose. Information is provided “as is”. The Discloser does not warrant accuracy or completeness except as a later signed supply contract may state. Neither Party is obliged to enter into any further agreement or to continue discussions.",
    },
    {
      heading: "8. Term, survival, return and destruction",
      body: "This Agreement takes effect on the date first written above and continues for [TERM: three (3) years]. Confidentiality obligations survive for three (3) years after the last disclosure under this Agreement. Obligations in respect of trade secrets and source code survive until the information is no longer secret through no fault of the Recipient. Obligations in respect of Personal Data survive for as long as the Recipient holds that data.",
      paragraphs: [
        "Within thirty (30) days after written request, or after the Purpose ends, the Recipient shall return or securely destroy Confidential Information and certify destruction, except that (a) one copy may be retained in a restricted legal archive for the longer of dispute limitation periods and regulatory retention, and (b) backup media may expire in the ordinary cycle provided they remain subject to this Agreement. Destruction of Personal Data must follow PDPL erasure rules where they apply.",
      ],
    },
    {
      heading: "9. Publicity",
      body: `Neither Party shall issue a press release, case study, or social-media post that names the other Party or ${product} without prior written consent, except that ${vendor} may list ${client} as a confidential prospect internally. After a public award announcement by ${client}, ${vendor} may state that it is a contractor only to the extent the announcement already discloses.`,
    },
    {
      heading: "10. Non-solicitation of staff (narrow)",
      body: "During the term and for six (6) months after, neither Party shall solicit for employment a named individual of the other Party who was introduced solely in connection with the Purpose. This does not restrict (a) general advertisements not targeted at that person, or (b) hiring a person who approaches without solicitation. [DELETE THIS CLAUSE if the issuer’s RFP forbids non-solicit.]",
    },
    {
      heading: "11. Remedies",
      body: "The Recipient acknowledges that breach may cause irreparable harm for which damages are not an adequate remedy. The Discloser may seek injunctive or other equitable relief from a court of competent jurisdiction without proving actual damage and without a requirement to post a bond to the extent the forum allows. That right is in addition to any other remedy. No party limits liability for fraud or for unauthorised disclosure of Confidential Information caused by its wilful misconduct.",
      paragraphs: [
        "[PENALTY — usually omit.] The Parties do not agree a liquidated-damages formula. If a government issuer mandates a penalty, insert a reasonable pre-estimate here and have both finance teams sign off; UAE courts may adjust contractual penalties.",
      ],
    },
    {
      heading: "12. Residuals [OPTIONAL — default delete for government]",
      body: "[OPTIONAL] The Recipient may use Residuals for any purpose. “Residuals” means information in intangible form retained in the unaided memory of Representatives who have had authorised access, excluding source code, Personal Data, security credentials, and items the Representative actually remembers were identified as a trade secret. This clause does not permit copying documents or code. Strike this entire clause unless both commercial parties insist.",
    },
    {
      heading: "13. Export and sanctions",
      body: "Each Party shall comply with applicable UAE, UN, EU, UK, and US export-control and sanctions laws to the extent they apply to the information or the Party. Confidential Information shall not be exported or re-exported in violation of those laws.",
    },
    {
      heading: "14. Notices",
      body: "Notices under this Agreement must be in writing (English) and delivered by hand, internationally recognised courier, or email with delivery receipt to:",
      table: {
        caption: "Notice details — complete before signature",
        headers: ["Party", "Address", "Email", "Marked for"],
        rows: [
          [client, "[ADDRESS]", "[legal@…]", "Legal / procurement"],
          [vendor, "[ADDRESS]", "[legal@…]", "General counsel / delivery lead"],
        ],
      },
      paragraphs: [
        "A notice is deemed received on the next working day in Dubai after email transmission if no bounce is received, or on the date of courier signed delivery. A Party may change details by notice.",
      ],
    },
    {
      heading: "15. Assignment and subcontracting",
      body: "A Party shall not assign this Agreement without the other Party’s prior written consent, except to an Affiliate or to a successor of substantially all of its relevant business, provided the assignee is bound in writing. The assignor remains liable if the assignee does not perform. Disclosure to a subcontractor is permitted only as a Representative under clause 5.",
    },
    {
      heading: "16. Entire agreement; variation; waiver; severability",
      body: "This Agreement is the entire agreement on confidentiality for the Purpose and supersedes prior NDAs on the same Purpose unless a prior NDA is expressly kept alive for a different project. A variation must be in writing and signed (including qualified electronic signature). A failure to enforce is not a waiver. If a provision is held unenforceable, it is modified to the minimum extent required and the rest remains in force.",
    },
    {
      heading: "17. Counterparts and electronic signature",
      body: "This Agreement may be executed in counterparts (including PDF and approved e-sign platforms). Each counterpart is an original; together they are one instrument.",
    },
    {
      heading: "18. Governing law and disputes",
      body: "[GOVERNING LAW] This Agreement is governed by the laws of the United Arab Emirates as applied in the Emirate of Dubai. The Parties submit to the exclusive jurisdiction of the Courts of Dubai. [ALTERNATIVE A: DIFC Courts, English language. ALTERNATIVE B: ADGM Courts. ALTERNATIVE C: arbitration seated in Dubai under DIAC Rules, one arbitrator, English language. Government entities often require onshore courts and Arabic. Do not mix alternatives in an executed copy.]",
      paragraphs: [
        "The Parties shall attempt in good faith to resolve a dispute by notice and a meeting of authorised representatives within fifteen (15) working days before filing, except that a Party may seek interim injunctive relief at any time.",
      ],
    },
    {
      heading: "19. Execution",
      body: "IN WITNESS WHEREOF the Parties have executed this Agreement on the date first written above, by their duly authorised signatories. Each signatory represents that they have authority to bind the Party named.",
      table: {
        caption: `${client} (First Party)`,
        headers: ["Field", "Value"],
        rows: [
          ["Authorised signatory name", ""],
          ["Title", ""],
          ["Date", ""],
          ["Signature", ""],
          ["Company stamp (if used)", ""],
        ],
      },
    },
    {
      heading: "19A. Second Party execution",
      body: `${vendor} (Second Party).`,
      table: {
        caption: `${vendor} (Second Party)`,
        headers: ["Field", "Value"],
        rows: [
          ["Authorised signatory name", ""],
          ["Title", ""],
          ["Date", ""],
          ["Signature", ""],
          ["Company stamp (if used)", ""],
        ],
      },
    },
  ];
}

export function buildMsa(
  product: string,
  client: string,
  vendor: string,
  brief: PlannerBrief,
  modules: string[],
  months: number,
  users: number,
  constraints: string,
  briefing: string,
  start: string
): DocSection[] {
  const deploy = deployPhrase(brief.deployment);
  const startLong = todayLong(start);
  return [
    {
      heading: "0. How to use this draft",
      body: `This is a Master Services Agreement (professional services + software implementation) for ${product}. It is designed to sit above the Statement of Work, BOQ, and design pack. Counsel must complete every [BRACKET], confirm insurance figures, liability, and forum, and issue an execution version. It is not legal advice and is not signed by generating this file.`,
      table: {
        caption: "Document architecture (order of precedence — clause 28)",
        headers: ["Rank", "Instrument", "Wins on"],
        rows: [
          ["1", "This MSA (including Schedules 2–4)", "Law, liability, IP, data, HR, termination"],
          ["2", "Schedule 1 — Order Form (when priced and signed)", "Fees, payment, named start date"],
          ["3", "Statement of Work in this pack", "Scope, acceptance, RACI, calendar"],
          ["4", "HLD / LLD / BRD / PRD after freeze", "Technical “how” — OpenAPI wins over pictures after freeze"],
          ["5", "BOQ", "Planning quantities only, unless the Order Form incorporates line prices"],
        ],
      },
      paragraphs: [
        "Search Word for “[” before sending. Optional clauses are labelled OPTIONAL. Government issuers typically delete Supplier-friendly options (convenience termination by Supplier, residuals, marketing).",
      ],
    },
    {
      heading: "Parties and date",
      body: `This Master Services Agreement (the “Agreement”) is made on ${startLong} (or last signature) between ${client} (the “Customer”) and ${vendor} (the “Supplier”). Details for notices are in Schedule 1. Each Party represents it has capacity and authority to enter into this Agreement.`,
    },
    {
      heading: "Recitals",
      body: "The recitals are operative.",
      numbered: [
        `The Customer wishes to obtain professional services and a working ${brief.kind} known as ${product} (${deploy}; approximately ${users.toLocaleString()} named users; planning duration ${months} months).`,
        `The Supplier is willing to provide those services on a statement-of-work basis.`,
        `Need as briefed: ${briefing}`,
        `Hard constraints the Parties already know: ${constraints}`,
        "The Parties have exchanged or will exchange confidential information under a separate NDA. That NDA remains in force.",
      ],
    },
    {
      heading: "1. Interpretation",
      body: "Defined terms appear throughout. Additional definitions:",
      table: {
        caption: "MSA definitions",
        headers: ["Term", "Meaning"],
        rows: [
          ["Background IP", "IP owned or licensed by a Party before this Agreement, or developed independently of the Services."],
          ["Foreground IP", `IP created by the Supplier specifically for the Customer in the course of the Services for ${product}, excluding Background IP and third-party materials.`],
          ["Fees", "Amounts in a signed Order Form or SOW commercial schedule, exclusive of VAT unless stated."],
          ["Good Industry Practice", "The skill and care reasonably expected of a competent UAE-based supplier of similar systems."],
          ["Services", "The work described in each SOW, including design, build, test, cutover, and hypercare as scoped."],
          ["SOW", "A statement of work signed under this Agreement, including the SOW generated in this pack once the Parties execute it or an equivalent."],
          ["Working Day", "A day other than Friday, Saturday, and UAE public holidays, in the Emirate where the Customer is based, unless the SOW says GST business days otherwise."],
        ],
      },
      paragraphs: [
        "If an SOW conflicts with this Agreement, this Agreement prevails except where the SOW expressly states that a named clause of the SOW overrides a named clause of this Agreement for that SOW only.",
      ],
    },
    {
      heading: "2. Appointment and statements of work",
      body: "The Customer appoints the Supplier, on a non-exclusive basis, to perform the Services. Neither Party promises a volume of work beyond a signed SOW. An SOW is not effective until signed by both Parties (qualified e-sign permitted).",
      numbered: [
        "Each SOW shall state scope, deliverables, acceptance, Customer dependencies, fees or a pointer to the Order Form, and a calendar.",
        `In-scope capabilities contemplated for the first SOW: ${modules.join("; ")}.`,
        "Change control in the SOW is the only way to add Must-scope. Email is not an SOW.",
        "The Supplier shall not be obliged to perform work that would breach applicable law, sanctions, or the Customer’s written security policy once provided.",
      ],
    },
    {
      heading: "3. Supplier obligations",
      body: "The Supplier shall:",
      numbered: [
        "perform the Services in accordance with this Agreement, the SOW, and Good Industry Practice;",
        "assign personnel who are competent for the roles named in the SOW;",
        "comply with lawful, written site and security rules when on Customer premises or networks;",
        "maintain the insurance in Schedule 4 for the term plus three (3) years;",
        "not introduce malware knowingly, and use commercially reasonable scanning;",
        "keep a RAID log and notify the Customer promptly of a fact that will materially affect dates or Fees;",
        "ensure subcontractors are bound in writing to confidentiality, data, and IP terms no less strict, and remain liable for them.",
      ],
    },
    {
      heading: "4. Customer obligations",
      body: "The Customer shall:",
      numbered: [
        "nominate a product owner with authority to accept increments;",
        "provide access, IdP metadata, sample data, and decisions within the times in the SOW (default: ten (10) Working Days for access, five (5) Working Days for reviews);",
        "staff UAT with real users of each persona; the Supplier cannot sign UAT for the Customer;",
        "obtain licences for Customer-provided software and data;",
        "pay undisputed Fees when due;",
        "own CAB / production change windows.",
      ],
      paragraphs: [
        "Delay in Customer obligations is a day-for-day extension of Supplier dates and, if it causes demonstrable wasted cost, a charge at the rates in the Order Form after five (5) Working Days’ notice. The Supplier shall mitigate.",
      ],
    },
    {
      heading: "5. Personnel; no employment; visas",
      body: "Nothing in this Agreement creates a partnership, joint venture, or employment. Supplier personnel remain employed (or contracted) by the Supplier. The Supplier is responsible for UAE labour, immigration, and end-of-service payments for its staff. The Customer shall not instruct Supplier staff as employees. Non-solicitation: twelve (12) months after the last SOW, neither Party shall solicit a named individual of the other who performed the Services, subject to the same advertisement exceptions as the NDA. [OPTIONAL for government: delete non-solicit.]",
    },
    {
      heading: "6. Fees, invoices, tax, set-off",
      body: "Fees are in the Order Form (Schedule 1) or the SOW. Unless stated, Fees are in AED and exclusive of VAT. The Customer shall pay valid invoices within thirty (30) days of receipt (or the Order Form period). Invoices follow the SOW payment gates. The Supplier may charge statutory or agreed interest on overdue undisputed sums [INSERT rate, often EIBOR + 2% or 1% per month — confirm with finance].",
      paragraphs: [
        "The Customer may withhold only the portion of an invoice that it disputes in writing within ten (10) Working Days, with reasons. It shall pay the rest. The Parties shall meet within five (5) Working Days to resolve the dispute.",
        "Each Party bears its own income tax. Reverse-charge or withholding, if required by law, is deducted and evidenced. Travel is at cost with prior written approval.",
        "The BOQ in the delivery pack is a planning estimate (AACE Class 4/5). It is not a price unless Schedule 1 incorporates named lines.",
      ],
    },
    {
      heading: "7. Acceptance",
      body: "Acceptance of Services and software is as set out in the SOW. If the SOW is silent: the Customer has five (5) Working Days from submission to accept, reject with defects citing requirement or test IDs, or comment. Two comment rounds are included per deliverable. Silence is deemed acceptance. Preference is not a defect. Software is accepted when mapped Must / P0 tests pass or are waived, Sev-1 is zero, and Sev-2 has a dated fix-forward.",
    },
    {
      heading: "8. Warranties",
      body: "Each Party warrants it has authority to enter this Agreement. The Supplier warrants that:",
      numbered: [
        "it will perform with Good Industry Practice;",
        "Foreground IP will not, to its actual knowledge after reasonable enquiry, infringe a third-party IP right in the UAE;",
        "Delivered software will, for thirty (30) days after final acceptance (the “Warranty Period”), conform in all material respects to the accepted SOW and frozen OpenAPI;",
        "it will remedy a reproducible Warranty Period defect at no charge, or refund the Fees for the defective part if it cannot remedy within a reasonable time.",
      ],
      paragraphs: [
        "The Supplier does not warrant uninterrupted or error-free operation, nor that the software will meet requirements not in an accepted SOW. Hardware and third-party licences carry the manufacturer’s warranty only. EXCEPT AS STATED, ALL OTHER WARRANTIES, INCLUDING MERCHANTABILITY AND FITNESS FOR A PURPOSE, ARE DISCLAIMED TO THE EXTENT PERMITTED BY UAE LAW. Statutory rights that cannot be excluded remain.",
      ],
    },
    {
      heading: "9. Intellectual property",
      body: `On payment of the related Fees, Foreground IP in configuration and custom code for ${product} vests in the Customer. The Supplier hereby assigns (and shall procure assignment of) that Foreground IP. The Supplier retains Background IP and tools. The Customer receives a non-exclusive, perpetual, royalty-free licence to use Background IP solely as embedded in the deliverables for the Customer’s internal operation of ${product}. Third-party components remain under their licences; the Supplier shall provide a bill of materials on request after go-live.`,
      paragraphs: [
        "The Customer grants the Supplier a limited licence to use Customer materials solely to perform the Services. Pre-existing Customer data remains the Customer’s.",
        "Until Fees for a deliverable are paid, the licence to use that deliverable in production is suspended except for UAT. Title to hardware in a BOQ passes only if the Supplier is the seller and the Order Form says so — default: Customer buys hardware itself.",
      ],
    },
    {
      heading: "10. Confidentiality",
      body: "The Parties’ NDA applies to this Agreement and the Services. If there is no NDA, clauses 4–8 and 11 of the pack NDA are incorporated by reference, with a three (3) year survival from termination. Public procurement announcements are not a breach to the extent they disclose only what the Customer has already published.",
    },
    {
      heading: "11. Data protection and security",
      body: "Schedule 3 (data processing) applies whenever the Supplier processes Personal Data for the Customer. The Supplier shall not process Personal Data except on documented instructions. Default residency: United Arab Emirates, consistent with the HLD. Encryption in transit (TLS) and at rest for databases and backups is mandatory. Security incidents involving Personal Data or a confirmed Sev-1 security event shall be notified to the Customer without undue delay and in any event within seventy-two (72) hours of the Supplier becoming aware, with facts then known and a plan.",
      paragraphs: [
        "The Customer is responsible for the lawfulness of collection and for notices to data subjects except where the Supplier acts as controller for its own staff data.",
      ],
    },
    {
      heading: "12. Security testing and audit",
      body: "The Customer (or an independent firm bound by confidentiality) may, on ten (10) Working Days’ notice, not more than once per twelve (12) months plus for cause after a Sev-1, audit the Supplier’s controls relevant to the Services, during business hours, without disrupting other customers. The Supplier shall provide evidence reasonably requested. VA/PT of the delivered system is scoped in the SOW; the Customer owns the report; the Supplier remediates findings it caused, at its cost for High/Critical before go-live unless waived.",
    },
    {
      heading: "13. Indemnities",
      body: "The Supplier shall indemnify the Customer against proven third-party claims that the Foreground IP as delivered and used in the UAE in accordance with this Agreement infringes that third party’s IP, provided the Customer gives prompt notice, exclusive conduct of the defence (with the Customer’s reasonable consultation), and does not admit liability. The Supplier may procure a right of continued use, modify to be non-infringing, or refund Fees for the infringing part and terminate that part. This indemnity does not apply to combinations, Customer materials, or use after a required modification is refused.",
      paragraphs: [
        "Each Party shall indemnify the other against claims arising from its own fraud, death or personal injury caused by its negligence, and its employees’ wilful misconduct on the other’s site.",
        "The Customer shall indemnify the Supplier against claims that Customer data or instructions infringe third-party rights or PDPL.",
      ],
    },
    {
      heading: "14. Liability",
      body: "NOTHING IN THIS AGREEMENT EXCLUDES OR LIMITS LIABILITY FOR FRAUD, FRAUDULENT MISREPRESENTATION, DEATH OR PERSONAL INJURY CAUSED BY NEGLIGENCE, OR ANY LIABILITY THAT CANNOT BE LIMITED UNDER UAE LAW.",
      paragraphs: [
        "Subject to that sentence: (a) neither Party is liable for loss of profit, revenue, goodwill, anticipated savings, or indirect or consequential loss, whether in contract, tort, or otherwise, even if advised; (b) each Party’s total aggregate liability arising out of this Agreement and all SOWs is limited to the Fees paid (and due but unpaid) under the relevant SOW in the twelve (12) months before the first claim; (c) liability for breach of confidentiality and for the IP indemnity in clause 13 is limited to two hundred per cent (200%) of those Fees.",
        "[NEGOTIATE] Some Customers require an unlimited IP indemnity and a higher cap for data. Some Suppliers require a super-cap of AED [AMOUNT] if Fees are small. Do not leave both a percentage and a ceiling inconsistent.",
        "A Party must notify a claim within a reasonable time after it becomes aware of the facts, and in any event within two (2) years after the event (or the minimum non-excludable limitation period).",
      ],
    },
    {
      heading: "15. Insurance",
      body: "See Schedule 4. Certificates on request. Insurance does not cap liability except as clause 14 states.",
    },
    {
      heading: "16. Term and termination",
      body: `This Agreement starts on the date of last signature and continues until terminated. It remains in force while any SOW is live. Either Party may terminate this Agreement or an SOW for material breach if the breach is not remedied within thirty (30) days of notice (fifteen (15) days for non-payment). Either Party may terminate immediately if the other becomes insolvent, ceases business, or is subject to a sanctions designation that makes performance unlawful.`,
      paragraphs: [
        "The Customer may terminate an SOW for convenience after architecture freeze on thirty (30) days’ notice, paying Fees for work performed, committed third-party costs that cannot be cancelled, and [OPTIONAL demobilisation: 10% of remaining implementation Fees / or delete].",
        "[OPTIONAL] The Supplier may suspend for non-payment after fourteen (14) days’ further notice following the due date.",
        "On termination the Supplier shall deliver work-in-progress for paid Fees, return Customer materials, and provide reasonable handover at then-current rates. Clauses that by nature survive (IP, confidentiality, data, liability, governing law) survive.",
      ],
    },
    {
      heading: "17. Force majeure",
      body: "A Party is not liable for delay or failure caused by an event beyond its reasonable control, including act of government, war, terrorism, epidemic, failure of a third-party utility or national IdP, or natural disaster, provided it gives prompt notice and mitigates. Payment of Fees already due is not excused. If force majeure continues for more than sixty (60) days, either Party may terminate the affected SOW without penalty other than payment for work done.",
    },
    {
      heading: "18. Anti-bribery, tax evasion, modern slavery, sanctions",
      body: "Each Party shall comply with UAE Federal Decree-Law No. 31 of 2021 (and other applicable anti-bribery laws), shall not offer or accept a bribe, and shall maintain proportionate books and procedures. Each Party shall comply with applicable sanctions. The Supplier represents it is not a sanctioned person. A breach of this clause is a material breach not capable of remedy.",
    },
    {
      heading: "19. Records",
      body: "The Supplier shall keep reasonable records of time (if T&M), acceptance, and invoices for seven (7) years or any longer period required by UAE law, and shall provide copies reasonably required for Customer audit or tax.",
    },
    {
      heading: "20. Publicity",
      body: "As in the NDA. No logo use without consent.",
    },
    {
      heading: "21. Assignment",
      body: "Neither Party may assign without consent, not to be unreasonably withheld, except to an Affiliate or a purchaser of the relevant business that is not a direct competitor of the other Party in the UAE [NEGOTIATE competitor carve-out], provided the assignee is bound. The Supplier may subcontract as in clause 3, remaining liable.",
    },
    {
      heading: "22. Notices",
      body: "See Schedule 1. Email is valid if the notice is also copied to the legal address and no bounce is received. Deemed receipt: next Working Day in Dubai.",
    },
    {
      heading: "23. Variation, waiver, severability, third parties",
      body: `Variations must be signed. No waiver by silence. Unenforceable terms are severed. No third-party rights except Affiliates under confidentiality and Customer Affiliates authorised in an SOW to use ${product} internally.`,
    },
    {
      heading: "24. Entire agreement",
      body: "This Agreement and its Schedules and signed SOWs are the entire agreement on the Services and supersede prior proposals on the same subject, except the NDA and any existing MSA the Parties expressly keep. Each Party acknowledges it has not relied on a representation not set out herein, without prejudice to liability for fraud.",
    },
    {
      heading: "25. Counterparts; e-sign; language",
      body: "Counterparts and electronic signature permitted. English is the governing language. An Arabic translation may be attached for a government Customer; if both are signed and they conflict, [Customer legal to choose: Arabic / English] prevails.",
    },
    {
      heading: "26. Dispute resolution",
      body: "Good-faith negotiation for fifteen (15) Working Days after notice, then [GOVERNING LAW — pick one and delete the rest]: exclusive jurisdiction of the Courts of Dubai under UAE law as applied in Dubai; OR DIFC Courts under DIFC law; OR ADGM Courts; OR DIAC arbitration in Dubai, one arbitrator, English, confidential. Interim relief may be sought without waiting. Government Customers often require their Emirate’s onshore courts.",
    },
    {
      heading: "27. Costs",
      body: "Each Party bears its own negotiation costs. Stamp duty, if any, is [Customer / split].",
    },
    {
      heading: "28. Order of precedence",
      body: "As in the table in clause 0. A later signed variation prevails over an earlier one on the same subject.",
    },
    {
      heading: "Schedule 1 — Order Form (commercial)",
      body: "Complete and sign this schedule to price the first SOW. Until then, the BOQ remains planning only.",
      table: {
        caption: "Order Form — edit in Word",
        headers: ["Field", "Entry"],
        rows: [
          ["Customer legal name", client],
          ["Supplier legal name", vendor],
          ["Programme / product", product],
          ["SOW reference", "SOW-001 — implementation"],
          ["Start date", startLong],
          ["Duration (planning)", `${months} calendar months plus Customer delay`],
          ["Named users (sizing)", String(users)],
          ["Deployment", deploy],
          ["Currency", "AED"],
          ["Implementation Fees (ex-VAT)", "[AMOUNT]"],
          ["Payment profile", "10% M0 / 15% M1 / 40% build / 20% UAT / 15% go-live+hypercare (SOW default)"],
          ["Invoice period", "30 days from valid invoice"],
          ["VAT", "Extra at the prevailing UAE rate"],
          ["T&M rates (if used)", "Lead [ ] / Engineer [ ] / BA [ ] per day GST"],
          ["Customer notice email", "[ ]"],
          ["Supplier notice email", "[ ]"],
          ["Customer signatory", ""],
          ["Supplier signatory", ""],
        ],
      },
    },
    {
      heading: "Schedule 2 — Services outline (first SOW pointer)",
      body: `The first SOW is the Statement of Work in this delivery pack. Capabilities: ${modules.join(", ")}. Acceptance, RACI, INT register, and deemed-acceptance rules in that SOW apply to the Services once the SOW is signed.`,
    },
    {
      heading: "Schedule 3 — Data processing addendum (controller–processor)",
      body: `This Schedule applies when ${vendor} processes Personal Data for ${client} in delivering ${product}. ${client} is the controller (or as otherwise documented). ${vendor} is the processor.`,
      numbered: [
        "Subject matter: implementation, support, and hypercare of the product. Duration: the SOW term plus deletion period. Nature: hosting (if in Supplier environments), access for build/fix, logging. Purpose: perform the Services. Types of data: [staff identifiers, applicant data as in BRD — COMPLETE]. Categories of data subjects: [staff, applicants — COMPLETE].",
        "The processor shall process only on documented instructions, including as to transfers; ensure persons are committed to confidentiality; implement appropriate technical and organisational measures (encryption, access control, logging, backup); not engage a sub-processor without prior written authorisation (general authorisation for the named cloud/on-prem stack in the HLD is given, with notice of change); assist with data-subject requests, DPIAs, and PDPL consultations; delete or return Personal Data at the end of Services except where UAE law requires storage; and make available information reasonably necessary to demonstrate compliance.",
        "International transfers: none outside the UAE without an instruction and a lawful mechanism.",
        "Breach notice: as clause 11 of the MSA.",
        "The processor may not use Personal Data to train general AI models.",
      ],
    },
    {
      heading: "Schedule 4 — Insurance (planning figures)",
      body: "Maintain with insurers of reasonable standing. Figures are planning — confirm with the broker.",
      table: {
        caption: "Minimum cover",
        headers: ["Class", "Limit (AED)", "Notes"],
        rows: [
          ["Professional indemnity", "[5,000,000] any one claim / aggregate", "Includes IT & cyber professional"],
          ["Public / product liability", "[5,000,000]", "Premises and operations"],
          ["Cyber / network", "[5,000,000]", "If Supplier hosts; else Customer’s policy may lead"],
          ["Workers / WPS as required", "Statutory", "UAE labour"],
          ["Property of Supplier", "Replacement", "Kit on Customer site"],
        ],
      },
    },
    {
      heading: "Execution block — Customer",
      body: `Signed for and on behalf of ${client}.`,
      table: {
        caption: client,
        headers: ["Field", "Value"],
        rows: [
          ["Name", ""],
          ["Title", ""],
          ["Date", ""],
          ["Signature / e-sign certificate id", ""],
          ["Stamp", ""],
        ],
      },
    },
    {
      heading: "Execution block — Supplier",
      body: `Signed for and on behalf of ${vendor}.`,
      table: {
        caption: vendor,
        headers: ["Field", "Value"],
        rows: [
          ["Name", ""],
          ["Title", ""],
          ["Date", ""],
          ["Signature / e-sign certificate id", ""],
          ["Stamp", ""],
        ],
      },
    },
  ];
}
