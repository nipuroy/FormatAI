/**
 * Automated Test Suite for FormatAI Modular Skills Architecture.
 *
 * Verifies:
 * 1. Initial 10 Skills registration and metadata (name, description, version, enabled state, rules)
 * 2. Independent skill processing rules and validation
 * 3. Disabled skill isolation (disabled skill must NOT process or alter document)
 * 4. Full Orchestrator Pipeline: Input -> Skill Orchestrator -> Enabled Skills -> Document Model -> Export
 * 5. Dynamic extensibility (registering an 11th skill at runtime without core changes)
 */

import { SkillRegistry } from '../frontend/src/skills/SkillRegistry';
import { SkillOrchestrator } from '../frontend/src/skills/SkillOrchestrator';
import { DocumentSkill, SkillContext, SkillValidationResult } from '../frontend/src/skills/types';
import { DocumentBlock } from '../frontend/src/types/document';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${msg}`);
    process.exit(1);
  }
}

async function runSkillsTests() {
  console.log('🧪 Starting Modular Skills Architecture Test Suite...\n');

  const registry = new SkillRegistry();
  const orchestrator = new SkillOrchestrator(registry);

  // -------------------------------------------------------------------------
  // Test 1: Registry Inventory & Metadata Check
  // -------------------------------------------------------------------------
  const allSkills = registry.getAll();
  assert(allSkills.length === 10, `Expected 10 default skills, found ${allSkills.length}`);

  const requiredSkillIds = [
    'academic_formatting',
    'mathematics',
    'statistics',
    'chemistry',
    'citation_references',
    'tables',
    'exam_questions',
    'study_notes',
    'markdown_cleanup',
    'scientific_formatting',
  ];

  for (const id of requiredSkillIds) {
    const s = registry.get(id);
    assert(s !== undefined, `Skill '${id}' must be registered`);
    assert(typeof s?.name === 'string' && s.name.length > 0, `Skill '${id}' must have a name`);
    assert(typeof s?.description === 'string' && s.description.length > 0, `Skill '${id}' must have a description`);
    assert(typeof s?.version === 'string' && s.version.length > 0, `Skill '${id}' must have a version`);
    assert(s?.enabled === true, `Skill '${id}' starts enabled by default`);
    assert(Array.isArray(s?.rules) && s.rules.length > 0, `Skill '${id}' must define processing rules`);
  }
  console.log('✅ Test 1 Passed: All 10 skills verified with name, description, version, enabled state, and rules.');

  // -------------------------------------------------------------------------
  // Test 2: Academic Formatting Skill
  // -------------------------------------------------------------------------
  const acadSkill = registry.get('academic_formatting')!;
  const acadCtx: SkillContext = { metadata: {}, detectedFeatures: new Set() };
  const acadInput = '# Quantum Mechanics\n##Introduction\nParagraph content.';
  const acadRes = acadSkill.processText(acadInput, acadCtx);
  assert(acadRes.text.includes('## Introduction'), 'Normalized heading spacing after hashes');
  assert(acadCtx.title === 'Quantum Mechanics', 'Extracted document title');
  console.log('✅ Test 2 Passed: Academic Formatting skill correctly normalizes headings and extracts title.');

  // -------------------------------------------------------------------------
  // Test 3: Mathematics Skill
  // -------------------------------------------------------------------------
  const mathSkill = registry.get('mathematics')!;
  const mathCtx: SkillContext = { metadata: {}, detectedFeatures: new Set() };
  const mathInput = 'Equation \\(E = mc^2\\) and \\[H\\psi = E\\psi\\]. Exactly 5/10 students passed.';
  const mathRes = mathSkill.processText(mathInput, mathCtx);
  assert(mathRes.text.includes('$E = mc^2$'), 'Normalized inline \\( ... \\) to $ ... $');
  assert(mathRes.text.includes('$$'), 'Normalized display \\[ ... \\] to $$ ... $$');
  assert(mathRes.text.includes('5/10 students passed'), 'Preserved prose slash in "5/10 students"');
  assert(mathCtx.detectedFeatures.has('mathematics'), 'Recorded mathematics feature tag');
  console.log('✅ Test 3 Passed: Mathematics skill normalizes LaTeX equations while safeguarding ordinary prose slashes.');

  // -------------------------------------------------------------------------
  // Test 4: Statistics Skill
  // -------------------------------------------------------------------------
  const statSkill = registry.get('statistics')!;
  const statCtx: SkillContext = { metadata: {}, detectedFeatures: new Set() };
  const statInput = 'Significant difference observed, p = 0.000, with t(24) = 3.12 and 95% CI [0.15, 0.65].';
  const statRes = statSkill.processText(statInput, statCtx);
  assert(statRes.text.includes('p < .001'), 'Replaced p = 0.000 with p < .001 per APA style');
  assert(statCtx.detectedFeatures.has('statistics'), 'Flagged statistics feature');
  console.log('✅ Test 4 Passed: Statistics skill validates and enforces empirical statistical reporting standards.');

  // -------------------------------------------------------------------------
  // Test 5: Chemistry Skill
  // -------------------------------------------------------------------------
  const chemSkill = registry.get('chemistry')!;
  const chemCtx: SkillContext = { metadata: {}, detectedFeatures: new Set() };
  const chemInput = 'The synthesis of H2O and CO2 via 2H2 + O2 -> 2H2O.';
  const chemRes = chemSkill.processText(chemInput, chemCtx);
  assert(chemRes.text.includes('H₂O'), 'Subscripted H2O to H₂O');
  assert(chemRes.text.includes('CO₂'), 'Subscripted CO2 to CO₂');
  assert(chemRes.text.includes('→'), 'Converted reaction arrow -> to →');
  assert(chemCtx.detectedFeatures.has('chemistry'), 'Flagged chemistry feature');
  console.log('✅ Test 5 Passed: Chemistry skill standardizes chemical formulas and reaction equilibrium arrows.');

  // -------------------------------------------------------------------------
  // Test 6: Citation/References Skill
  // -------------------------------------------------------------------------
  const citeSkill = registry.get('citation_references')!;
  const citeCtx: SkillContext = { metadata: {}, detectedFeatures: new Set() };
  const citeInput = 'Previous findings [1] confirmed by Smith (2020). See doi: 10.1038/nature12345.';
  const citeRes = citeSkill.processText(citeInput, citeCtx);
  assert(citeRes.text.includes('https://doi.org/10.1038/nature12345'), 'Canonicalized DOI URL link');
  assert(citeCtx.detectedFeatures.has('citations'), 'Flagged citations feature');
  console.log('✅ Test 6 Passed: Citation/References skill standardizes citations and DOI hyperlinks.');

  // -------------------------------------------------------------------------
  // Test 7: Tables Skill
  // -------------------------------------------------------------------------
  const tableSkill = registry.get('tables')!;
  const tableCtx: SkillContext = { metadata: {}, detectedFeatures: new Set() };
  const tableInput = '| Header A | Header B |\n|:---|:---:|\n| Val 1 | Val 2 |';
  const tableRes = tableSkill.processText(tableInput, tableCtx);
  assert(tableCtx.detectedFeatures.has('tables'), 'Detected tables in text');
  console.log('✅ Test 7 Passed: Tables skill indexes pipe table structures.');

  // -------------------------------------------------------------------------
  // Test 8: Exam Questions Skill
  // -------------------------------------------------------------------------
  const examSkill = registry.get('exam_questions')!;
  const examCtx: SkillContext = { metadata: {}, detectedFeatures: new Set() };
  const examInput = 'Question 1: [5 marks] Name the capital of France: _______';
  const examRes = examSkill.processText(examInput, examCtx);
  assert(examCtx.detectedFeatures.has('exam_questions'), 'Detected exam question');
  assert(examRes.text.includes('__________'), 'Standardized answer blank length');
  console.log('✅ Test 8 Passed: Exam Questions skill detects questions and normalizes answer fill lines.');

  // -------------------------------------------------------------------------
  // Test 9: Study Notes Skill
  // -------------------------------------------------------------------------
  const studySkill = registry.get('study_notes')!;
  const studyCtx: SkillContext = { metadata: {}, detectedFeatures: new Set() };
  const studyInput = 'Key Takeaway: Quantum entanglement is non-local.';
  studySkill.processText(studyInput, studyCtx);
  assert(studyCtx.detectedFeatures.has('study_notes'), 'Detected study takeaway callout');
  console.log('✅ Test 9 Passed: Study Notes skill detects key takeaway markers.');

  // -------------------------------------------------------------------------
  // Test 10: Markdown Cleanup Skill
  // -------------------------------------------------------------------------
  const cleanSkill = registry.get('markdown_cleanup')!;
  const cleanCtx: SkillContext = { metadata: {}, detectedFeatures: new Set() };
  const cleanInput = 'Sure thing! Here is the academic paper you requested:\n\n# Body\n\nHope this helps!';
  const cleanRes = cleanSkill.processText(cleanInput, cleanCtx);
  assert(!cleanRes.text.includes('Sure thing!'), 'Stripped AI greeting prefix');
  assert(!cleanRes.text.includes('Hope this helps!'), 'Stripped AI sign-off suffix');
  assert(cleanRes.text.includes('# Body'), 'Preserved body text intact');
  assert(cleanCtx.detectedFeatures.has('denoised'), 'Flagged denoised feature');
  console.log('✅ Test 10 Passed: Markdown Cleanup skill removes AI preamble/sign-off chatter.');

  // -------------------------------------------------------------------------
  // Test 11: Scientific Document Formatting Skill
  // -------------------------------------------------------------------------
  const sciSkill = registry.get('scientific_formatting')!;
  const sciCtx: SkillContext = { metadata: {}, detectedFeatures: new Set() };
  const sciInput = 'The mass was 1.42 x 10^-22 kg·m/s at 25 deg C.';
  const sciRes = sciSkill.processText(sciInput, sciCtx);
  assert(sciRes.text.includes('1.42 × 10^{-22}'), 'Normalized exponential multiplication notation');
  assert(sciRes.text.includes('25 °C'), 'Normalized temperature degree mark');
  assert(sciCtx.detectedFeatures.has('scientific_notation'), 'Flagged scientific notation feature');
  console.log('✅ Test 11 Passed: Scientific Formatting skill normalizes scientific notation and SI units.');

  // -------------------------------------------------------------------------
  // Test 12: Disabled Skill Isolation Guarantee
  // -------------------------------------------------------------------------
  console.log('\nTesting Disabled Skill Isolation...');
  // Disable the Chemistry skill
  registry.setEnabled('chemistry', false);
  assert(registry.get('chemistry')?.enabled === false, 'Chemistry skill is now disabled');

  const testTextWithChemistry = 'Reaction: H2O and CO2 produce glucose.';
  const orchWithChemDisabled = orchestrator.process(testTextWithChemistry);

  // Because chemistry is disabled, H2O must NOT be converted to H₂O!
  assert(
    orchWithChemDisabled.cleanedText.includes('H2O'),
    'Disabled Chemistry skill did NOT alter H2O to H₂O'
  );
  assert(
    !orchWithChemDisabled.cleanedText.includes('H₂O'),
    'H₂O was NOT generated because chemistry skill was disabled'
  );
  const chemLog = orchWithChemDisabled.executionLogs.find((l) => l.skillId === 'chemistry');
  assert(chemLog === undefined, 'Disabled skill was completely bypassed by orchestrator');
  assert(orchWithChemDisabled.disabledSkillsCount === 1, 'Reported 1 disabled skill');
  console.log('✅ Test 12 Passed: A disabled skill is completely bypassed and does NOT alter the document.');

  // Re-enable Chemistry skill
  registry.setEnabled('chemistry', true);
  assert(registry.get('chemistry')?.enabled === true, 'Chemistry skill re-enabled');

  // -------------------------------------------------------------------------
  // Test 13: Full Pipeline Execution (Input -> Orchestrator -> AST Model)
  // -------------------------------------------------------------------------
  console.log('\nTesting Complete Orchestration Pipeline...');
  const sampleAcademicText = `Sure thing! Here is your paper:

# Quantum Electrodynamics & Vacuum Polarization

## Abstract
This paper investigates non-perturbative quantum electrodynamics in supercritical fields.

## 1. Mathematical Formulation
The relativistic dispersion relation is given by:
$$
E = \\sqrt{p^2 c^2 + m^2 c^4}
$$
In empirical trials, 5/10 experiments confirmed the prediction at momentum $p = 1.42 x 10^-22 kg·m/s$ at 25 deg C.

| Field | Yield | Status |
|:---|:---:|---:|
| Low | 100 | Active |
| High | 500 | Verified |

Key Takeaway: The vacuum behaves like a polarizable dielectric medium.

## References
[1] Dirac, P. A. M. (1928). The Quantum Theory of the Electron. doi: 10.1098/rspa.1928.0023

Hope this helps!`;

  const fullResult = orchestrator.process(sampleAcademicText);
  assert(fullResult.success === true, 'Orchestration succeeded');
  assert(fullResult.appliedSkillsCount >= 5, `Expected multiple skills applied, got ${fullResult.appliedSkillsCount}`);
  assert(!fullResult.cleanedText.includes('Sure thing!'), 'Chatter preamble removed');
  assert(!fullResult.cleanedText.includes('Hope this helps!'), 'Chatter outro removed');
  assert(fullResult.cleanedText.includes('1.42 × 10^{-22}'), 'Scientific notation formatted');
  assert(fullResult.cleanedText.includes('5/10 experiments'), 'Prose slash preserved');

  // Verify Document Model AST
  const doc = fullResult.document;
  assert(doc.title === 'Quantum Electrodynamics & Vacuum Polarization', 'Document title extracted correctly');
  assert(doc.blocks.length >= 6, `Expected rich AST blocks, got ${doc.blocks.length}`);

  const blockTypes = new Set(doc.blocks.map((b) => b.block_type));
  assert(blockTypes.has('heading'), 'Contains heading blocks');
  assert(blockTypes.has('math_block'), 'Contains math_block AST');
  assert(blockTypes.has('table'), 'Contains table AST');
  assert(blockTypes.has('paragraph'), 'Contains paragraph AST');
  assert(doc.statistics.word_count > 30, 'Calculated statistics word count');
  console.log('✅ Test 13 Passed: Full Orchestrator Pipeline produces publication-grade AcademicDocument AST.');

  // -------------------------------------------------------------------------
  // Test 14: Dynamic Extensibility (Zero Core Modifications)
  // -------------------------------------------------------------------------
  console.log('\nTesting Dynamic Skill Extensibility...');
  class CustomLegalCitationSkill implements DocumentSkill {
    readonly id = 'custom_legal_citations';
    readonly name = 'Legal Citations (Bluebook)';
    readonly description = 'Formats statutory codes and case citations according to Bluebook rules.';
    readonly version = '0.9.0';
    readonly category = 'formatting' as const;
    readonly priority = 48;
    enabled: boolean = true;
    readonly rules = [
      { id: 'us_code', name: 'U.S. Code Normalization', description: 'Formats 42 U.S.C. § 1983.' },
    ];

    validate(_text: string, _ctx: SkillContext): SkillValidationResult {
      return { valid: true, errors: [], warnings: [] };
    }

    processText(text: string, ctx: SkillContext): { text: string; changes: string[] } {
      const updated = text.replace(/42\s*USC\s*1983/gi, '42 U.S.C. § 1983');
      const applied = updated !== text;
      if (applied) ctx.detectedFeatures.add('legal_citations');
      return {
        text: updated,
        changes: applied ? ['Formatted 42 U.S.C. § 1983 statutory citation.'] : [],
      };
    }
  }

  // Register dynamically
  const customSkill = new CustomLegalCitationSkill();
  registry.register(customSkill);
  assert(registry.getAll().length === 11, 'Registry now holds 11 skills');
  assert(registry.get('custom_legal_citations') !== undefined, 'Custom skill retrieved');

  // Process with new skill active
  const legalResult = orchestrator.process('Under 42 USC 1983, plaintiff alleges liability.');
  assert(legalResult.cleanedText.includes('42 U.S.C. § 1983'), 'Custom skill executed and transformed text seamlessly');
  console.log('✅ Test 14 Passed: New custom skills can be registered dynamically at runtime without rewriting core code.');

  console.log('\n🎉 ALL 14 MODULAR SKILLS ARCHITECTURE TESTS PASSED!\n');
}

runSkillsTests();
