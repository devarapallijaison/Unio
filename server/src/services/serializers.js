/** Public-safe shapes. Never include emails, password hashes or internal user ids. */

export function publicUser(user) {
  if (!user) return null;
  return { _id: user._id, name: user.name, email: user.email, role: user.role, createdAt: user.createdAt };
}

/** Server-computed trust fields (services/trust.service.js). Read-only for every client. */
export function trustFields(p) {
  return {
    verifiedTools: p.verifiedTools ?? [],
    certifiedTools: p.certifiedTools ?? [],
    pendingTools: p.pendingTools ?? [],
    madeOnUnioCount: p.madeOnUnioCount ?? 0,
    ratingAvg: p.ratingCount ? p.ratingAvg : null,
    ratingCount: p.ratingCount ?? 0,
    trustLevel: p.trustLevel ?? 1,
  };
}

/**
 * Public creator. `skillCounts` (skill id → pieces proving it) decides which skills are shown:
 * a skill only appears when at least one portfolio piece backs it (guide §5.3).
 */
export function publicCreator(p, skillCounts = {}) {
  if (!p) return null;
  const backedSkills = (p.skills ?? []).filter((id) => skillCounts[id] > 0).map((id) => ({ id, pieces: skillCounts[id] }));
  return {
    _id: p._id,
    displayName: p.displayName,
    headline: p.headline ?? '',
    bio: p.bio,
    photoUrl: p.photoUrl,
    location: p.location,
    category: p.category ?? null,
    secondaryCategories: p.secondaryCategories ?? [],
    contentTypes: p.contentTypes ?? [],
    specializations: p.specializations ?? [],
    styles: p.styles ?? [],
    formats: p.formats ?? [],
    languages: p.languages ?? [],
    skills: backedSkills.map((s) => s.id),
    backedSkills,
    tools: p.tools,
    workflow: p.workflow ?? [],
    howIWork: p.howIWork ?? [],
    startingPrice: p.startingPrice,
    turnaroundDays: p.turnaroundDays ?? null,
    revisionsIncluded: p.revisionsIncluded ?? null,
    commerciallySafe: !!p.commerciallySafe,
    availability: p.availability,
    featured: p.featured,
    isDemo: p.isDemo,
    createdAt: p.createdAt,
    ...trustFields(p),
  };
}

export function creatorSummary(p) {
  if (!p) return null;
  return {
    _id: p._id,
    displayName: p.displayName,
    photoUrl: p.photoUrl,
    location: p.location,
    category: p.category ?? null,
    headline: p.headline ?? '',
    skills: p.skills,
    tools: p.tools,
    startingPrice: p.startingPrice,
    availability: p.availability,
    isDemo: p.isDemo,
    verifiedTools: p.verifiedTools ?? [],
    trustLevel: p.trustLevel ?? 1,
  };
}

export function publicBrand(b) {
  if (!b) return null;
  return {
    _id: b._id,
    companyName: b.companyName,
    logoUrl: b.logoUrl,
    websiteUrl: b.websiteUrl,
    industry: b.industry,
    description: b.description,
    isDemo: b.isDemo,
  };
}

export function campaignSummary(c) {
  if (!c) return null;
  return {
    _id: c._id,
    title: c.title,
    category: c.category,
    status: c.status,
    deadline: c.deadline,
    budgetMin: c.budgetMin,
    budgetMax: c.budgetMax,
  };
}
