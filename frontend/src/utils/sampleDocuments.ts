/**
 * Academic sample documents for 1-click test drive of the FormatAI pipeline.
 */

export interface SampleDocumentItem {
  id: string;
  title: string;
  category: string;
  content: string;
}

export const SAMPLE_DOCUMENTS: SampleDocumentItem[] = [
  {
    id: 'quantum-physics',
    title: 'Quantum Electrodynamics & Vacuum Polarization',
    category: 'Physics & Mathematics',
    content: `Sure thing! Here is the academic paper you requested on relativistic quantum electrodynamics:

# Quantum Electrodynamics & Vacuum Polarization in Strong External Fields

## Abstract
We examine non-perturbative vacuum polarization corrections in quantum electrodynamics subject to supercritical electrostatic potentials. By regularizing the fermion propagator in Fock-Schwinger gauge, we deduce the renormalized Euler-Heisenberg effective Lagrangian and compute the pair-production rate across sub-critical regimes.

## 1. Relativistic Dispersion and Energy Formulation
In the Dirac picture, relativistic single-particle eigenstates satisfy the energy-momentum invariant:
$$
E = \\sqrt{p^2 c^2 + m_0^2 c^4}
$$
In experimental verification trials, exactly 8/10 runs matched the predicted cross-section at momentum $p = 1.42 \\times 10^{-22}$ kg·m/s. The Newtonian kinetic energy approximation $E_k = \\frac{1}{2} m v^2$ deviates by 14.8% at velocities exceeding $v = 0.65c$.

## 2. Partition Functions & Thermodynamic Limits
For a canonical ensemble of non-interacting Fermi-Dirac oscillators, the grand partition function evaluates to:
$$
Z = \\sum_{n=0}^{\\infty} e^{-\\beta E_n}
$$
where $\\beta = \\frac{1}{k_B T}$ and $\\sigma^2$ is the energy variance across $\\alpha$-particles. The one-dimensional Gaussian normalization integral satisfies:
$$
\\int_{-\\infty}^{\\infty} e^{-a x^2} dx = \\sqrt{\\frac{\\pi}{a}}
$$
Furthermore, in the infrared threshold limit:
$$
\\lim_{x \\to 0} \\frac{\\sin x}{x} = 1
$$

## 3. Pauli Spin Operator Representations
In the chiral basis, the Pauli matrices spanning SU(2) algebra are represented as:
$$
\\sigma_x = \\begin{matrix} 0 & 1 \\\\ 1 & 0 \\end{matrix}, \\quad \\sigma_z = \\begin{matrix} 1 & 0 \\\\ 0 & -1 \\end{matrix}
$$

## 4. Empirical Benchmark Evaluations
Table 1 outlines empirical resonance cross-sections and detector error distributions:

| Field Strength ($E/E_{cr}$) | Yield (Events/s) | Confidence | Slashes In Text |
|:---|:---:|:---:|---:|
| 0.25 | $1.24 \\times 10^{4}$ | 99.4% | 5/10 runs |
| 0.50 | $4.88 \\times 10^{5}$ | 99.8% | 8/10 runs |
| 0.75 | $9.12 \\times 10^{6}$ | 99.9% | 10/10 runs |

## References
1. Dirac, P. A. M. (1928). The Quantum Theory of the Electron. Proceedings of the Royal Society of London, 117(778), 610-624.
2. Schwinger, J. (1951). On Gauge Invariance and Vacuum Polarization. Physical Review, 82(5), 664-679.
3. Feynman, R. P. (1949). Space-Time Approach to Quantum Electrodynamics. Physical Review, 76(6), 769-789.

Hope this helps! Let me know if you need any additional sections formatted.`,
  },
  {
    id: 'ai-transformer',
    title: 'Hierarchical Attention in Multi-Modal Transformers',
    category: 'Computer Science & AI',
    content: `Certainly! Below is the requested research paper on multi-modal transformers:

# Hierarchical Sparse Attention in Multi-Modal Deep Neural Architectures

## Abstract
Modern deep learning architectures suffer from quadratic time complexity $O(N^2)$ when processing multi-modal high-resolution context windows. We introduce a sparse hierarchical attention operator reducing computational complexity to $O(N \\log N)$ while preserving cross-modal representation fidelity.

## 1. Architectural Formulation
Given input sequence vectors $X \\in \\mathbb{R}^{N \\times d}$, the standard scaled dot-product attention maps queries $Q$, keys $K$, and values $V$ according to:
$$
\\text{Attention}(Q, K, V) = \\text{softmax}\\left(\\frac{Q K^T}{\\sqrt{d_k}}\\right) V
$$
In our latency trials, exactly 9/10 iterations completed within 18 ms on standard consumer accelerator hardware.

## 2. Empirical Benchmark Comparison
We evaluate parameter counts and inference speed across benchmark suites:

| Model Architecture | Parameters | Top-1 Accuracy | Latency (Batch=1) |
|:---|:---:|:---:|---:|
| Dense Transformer Baseline | 340M | 82.4% | 48 ms |
| Sparse Linear Attention | 280M | 81.1% | 22 ms |
| FormatAI Hierarchical | 215M | 85.9% | 14 ms |

## 3. Conclusions and Future Work
Hierarchical sparsity enables sequence scaling to millions of tokens without memory blowup.

## References
1. Vaswani, A., et al. (2017). Attention Is All You Need. Advances in Neural Information Processing Systems, 30.
2. Devlin, J., et al. (2018). BERT: Pre-training of Deep Bidirectional Transformers. arXiv preprint arXiv:1810.04805.`,
  },
  {
    id: 'molecular-biology',
    title: 'CRISPR Cas9 Genomic Cleavage Efficiency',
    category: 'Biotechnology & Medicine',
    content: `# Empirical Cleavage Kinetics in SpCas9 Guide RNA Optimization

## Abstract
Engineered CRISPR-Cas9 ribonucleoprotein complexes exhibit sequence-dependent off-target cleavage kinetics. This investigation quantifies mismatch tolerance across protospacer adjacent motif (PAM) proximal loci.

## 1. Cleavage Rate Model
The Michaelis-Menten kinetic rate for DNA strand cleavage is governed by:
$$
v = \\frac{V_{\\max} [S]}{K_m + [S]}
$$
Where $[S]$ denotes substrate target concentration and $K_m$ represents apparent binding affinity. In 14/15 cellular assays, dual guide RNAs prevented chromosomal translocations.

## 2. Off-Target Mutagenesis Frequencies

| Locus | Target Sequence | Mismatches | Cleavage Efficiency |
|:---|:---|:---:|---:|
| Site A | GACGGACCCATGCTAGATCG | 0 | 98.4% |
| Site B | GACGGACCCATGCTAGATGG | 1 | 12.1% |
| Site C | GACGTACCCATGCTAGATGG | 2 | 0.8% |

## References
1. Jinek, M., et al. (2012). A programmable dual-RNA-guided DNA endonuclease in adaptive bacterial immunity. Science, 337(6096), 816-821.
2. Doudna, J. A., & Charpentier, E. (2014). The new frontier of genome engineering with CRISPR-Cas9. Science, 346(6213), 1258096.`,
  },
];
