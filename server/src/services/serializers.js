/** Public-safe shapes. Never include emails, password hashes or internal user ids. */

export function publicUser(user) {
  if (!user) return null;
  return { _id: user._id, name: user.name, email: user.email, role: user.role, createdAt: user.createdAt };
}

export function publicCreator(p) {
  if (!p) return null;
  return {
    _id: p._id,
    displayName: p.displayName,
    bio: p.bio,
    photoUrl: p.photoUrl,
    location: p.location,
    skills: p.skills,
    tools: p.tools,
    specialties: p.specialties,
    startingPrice: p.startingPrice,
    availability: p.availability,
    featured: p.featured,
    isDemo: p.isDemo,
    createdAt: p.createdAt,
  };
}

export function creatorSummary(p) {
  if (!p) return null;
  return {
    _id: p._id,
    displayName: p.displayName,
    photoUrl: p.photoUrl,
    location: p.location,
    skills: p.skills,
    tools: p.tools,
    startingPrice: p.startingPrice,
    availability: p.availability,
    isDemo: p.isDemo,
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
