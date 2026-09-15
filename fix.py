with open("src/client/pages/DashboardPage.tsx", "r") as f:
    content = f.read()

fixed = content.replace("""                      {editingStock === stock.originalName ? (
                        <div className="flex items-center justify-end gap-2">
                          <input
                            type="number"
                            value={editingStockValue}
                            onChange={(e) => setEditingStockValue(e.target.value)}
                            className="w-24 px-2 py-1 text-sm border rounded"
                            autoFocus
                          />
                        </div>
                      ) : (
                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                          stock.currentStock > 0 ? 'bg-blue-50 text-blue-700' :
                          stock.currentStock < 0 ? 'bg-red-50 text-red-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {stock.currentStock} {stock.unit}
                      )}
                    </td>""", """                      {editingStock === stock.originalName ? (
                        <div className="flex items-center justify-end gap-2">
                          <input
                            type="number"
                            value={editingStockValue}
                            onChange={(e) => setEditingStockValue(e.target.value)}
                            className="w-24 px-2 py-1 text-sm border rounded"
                            autoFocus
                          />
                          <span className="text-gray-500 text-xs">{stock.unit}</span>
                        </div>
                      ) : (
                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                          stock.currentStock > 0 ? 'bg-blue-50 text-blue-700' :
                          stock.currentStock < 0 ? 'bg-red-50 text-red-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {stock.currentStock} {stock.unit}
                        </span>
                      )}
                    </td>""")

with open("src/client/pages/DashboardPage.tsx", "w") as f:
    f.write(fixed)
