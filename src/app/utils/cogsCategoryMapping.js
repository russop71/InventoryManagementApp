export function resolveCogsCategory(cogsCategories, posCategory, fallbackCategoryId) {
  const availableCategories = Array.isArray(cogsCategories) ? cogsCategories : [];
  const normalizedPosCategory = String(posCategory || '').trim().toLowerCase();
  const mappedCategory = availableCategories.find(category =>
    (category.posCategoryNames || []).some(name => String(name || '').trim().toLowerCase() === normalizedPosCategory)
  );
  const categoryId = mappedCategory?.id || fallbackCategoryId || 'uncategorized';
  const category = mappedCategory || availableCategories.find(item => item.id === categoryId);
  return {
    id: categoryId,
    name: category?.name || 'Uncategorized',
  };
}
