# Forest Capture: Scientific Methodologies & Citations Guide

This document formally details the ecological formulas, statistical indices, and survey assessment frameworks natively programmed into the Forest Capture application. It provides the definitive peer-reviewed citations that validate the application's scientific accuracy.

---

## 1. Biodiversity Indices (Quadrat Sampling)

Forest Capture automatically calculates alpha diversity indices on-device using raw organism counts and cross-sectional basal areas.

### 1.1. Shannon-Wiener Diversity Index ($H'$)
Calculated in the app as natural logarithmic ratio of proportional abundances: $H' = -\sum (p_i \times \ln(p_i))$
*   **Application Use:** Evaluates the uncertainty in predicting the species identity of an individual that is taken at random from the dataset.
*   **Citation:** Shannon, C. E., & Weaver, W. (1949). *The Mathematical Theory of Communication.* University of Illinois Press, Urbana.

### 1.2. Simpson’s Reciprocal Index ($1 / \lambda$)
Calculated for finite ecological samples using combinations: $\lambda = \sum \frac{n_i(n_i-1)}{N(N-1)}$. The application explicitly reverses this via $1 / \lambda$ so the index value scales *positively* with diversity (where higher numbers equal higher diversity).
*   **Application Use:** Measures dominance and the probability that two individuals randomly selected from a sample will belong to different species.
*   **Citation:** Simpson, E. H. (1949). *Measurement of diversity.* Nature, 163(4148), 688. 

### 1.3. Pielou’s Species Evenness ($J'$)
Calculated as the observed Shannon diversity divided by the maximum possible diversity: $J' = H' / \ln(S)$
*   **Application Use:** Determines how equitably the abundances of recorded taxa are distributed inside the quadrat (scaling exactly from 0.0 to 1.0).
*   **Citation:** Pielou, E. C. (1966). *The measurement of diversity in different types of biological collections.* Journal of Theoretical Biology, 13, 131–144.

### 1.4. Importance Value Index (IVI)
*   **Application Use:** Evaluates the overall ecological significance of tree species in a sampled forest stand by mathematically summing their Relative Density, Relative Frequency, and Relative Dominance (calculated via diameter at breast height into basal area `π × (DBH/2)²`).
*   **Citation:** Curtis, J. T., & McIntosh, R. P. (1951). *An upland forest continuum in the prairie-forest border region of Wisconsin.* Ecology, 32(3), 476-496.

---

## 2. Disturbance Metrics

### 2.1. Composite Burn Index (CBI)
The application’s "Environment & Disturbances" tool implements the tiered subjective severity rating (0 to 3 scale) across horizontal environmental layers.
*   **Application Use:** Allows researchers to rapidly quantify post-disturbance structural changes from the substrate/soil layer up through tall shrubs to the dominant intermediate and big-tree canopy.
*   **Citation:** Key, C. H., & Benson, N. C. (2006). *Landscape Assessment (LA). In: FIREMON: Fire effects monitoring and inventory system.* Gen. Tech. Rep. RMRS-GTR-164-CD. Fort Collins, CO: U.S. Department of Agriculture, Forest Service, Rocky Mountain Research Station.

---

## 3. Spatial Tools

### 3.1. Line Point-Intercept (Belt Transect)
Forest Capture's Transect module allows logging intercepts at explicit metric distances along a measured tape line set by an azimuth (compass bearing).
*   **Application Use:** Offers structured quantitative estimations of canopy spacing, substrate, and vegetation surface cover percentage defined by $\text{Cover \%} = \frac{\text{Intercept Hits}}{\text{Total Transect Points}}$.
*   **Citation:** Herrick, J. E., Van Zee, J. W., Havstad, K. M., Burkett, L. M., & Whitford, W. G. (2005). *Monitoring Manual for Grassland, Shrubland and Savanna Ecosystems.* USDA-ARS Jornada Experimental Range, Las Cruces, NM.

---

*These algorithms form the mathematical backbone of the `src/modules/analytics.js` system, guaranteeing that all offline calculations rendered in the UI match established peer-reviewed protocols exactly.*
