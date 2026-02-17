"use client";

import { useState, useCallback } from "react";
import { useRealtime } from "@/hooks/use-realtime";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Loader2 } from "lucide-react";
import type { ExpenseCategory } from "@/lib/types";
import { DEFAULT_EXPENSE_CATEGORIES } from "@/lib/constants";

interface ExpenseCategoriesProps {
  categories: ExpenseCategory[];
  userId: string;
}

export function ExpenseCategories({
  categories: initialCategories,
  userId,
}: ExpenseCategoriesProps) {
  const [categories, setCategories] = useState(initialCategories);
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Realtime subscription for expense_categories table
  useRealtime<ExpenseCategory>({
    table: "expense_categories",
    filter: `user_id=eq.${userId}`,
    onInsert: useCallback((record: ExpenseCategory) => {
      setCategories((prev) => {
        if (prev.some((c) => c.id === record.id)) return prev;
        return [...prev, record];
      });
    }, []),
    onUpdate: useCallback((record: ExpenseCategory) => {
      setCategories((prev) =>
        prev.map((c) => (c.id === record.id ? { ...c, ...record } : c))
      );
    }, []),
    onDelete: useCallback((record: ExpenseCategory) => {
      setCategories((prev) => prev.filter((c) => c.id !== record.id));
    }, []),
  });

  const supabase = createClient();

  async function seedDefaults() {
    setLoading(true);
    const inserts = DEFAULT_EXPENSE_CATEGORIES.map((name) => ({
      user_id: userId,
      name,
      is_default: true,
    }));

    const { data, error } = await supabase
      .from("expense_categories")
      .insert(inserts)
      .select();

    if (error) {
      toast.error("Failed to seed categories: " + error.message);
    } else if (data) {
      setCategories((prev) => [...prev, ...data]);
      toast.success("Default categories added");
    }
    setLoading(false);
  }

  async function addCategory() {
    if (!newName.trim()) return;
    setLoading(true);

    const { data, error } = await supabase
      .from("expense_categories")
      .insert({ user_id: userId, name: newName.trim() })
      .select()
      .single();

    if (error) {
      toast.error("Failed to add category: " + error.message);
    } else if (data) {
      setCategories((prev) => [...prev, data]);
      setNewName("");
      setDialogOpen(false);
      toast.success("Category added");
    }
    setLoading(false);
  }

  async function updateCategory(id: string) {
    if (!editName.trim()) return;
    setLoading(true);

    const { error } = await supabase
      .from("expense_categories")
      .update({ name: editName.trim() })
      .eq("id", id);

    if (error) {
      toast.error("Failed to update category: " + error.message);
    } else {
      setCategories((prev) =>
        prev.map((c) => (c.id === id ? { ...c, name: editName.trim() } : c))
      );
      setEditingId(null);
      toast.success("Category updated");
    }
    setLoading(false);
  }

  async function deleteCategory(id: string) {
    const { error } = await supabase
      .from("expense_categories")
      .delete()
      .eq("id", id);

    if (error) {
      toast.error("Failed to delete category: " + error.message);
    } else {
      setCategories((prev) => prev.filter((c) => c.id !== id));
      toast.success("Category deleted");
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Expense Categories</CardTitle>
        <div className="flex gap-2">
          {categories.length === 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={seedDefaults}
              disabled={loading}
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Load Defaults
            </Button>
          )}
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Plus className="mr-2 h-4 w-4" />
                Add
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Category</DialogTitle>
              </DialogHeader>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Category name"
                onKeyDown={(e) => e.key === "Enter" && addCategory()}
              />
              <DialogFooter>
                <Button onClick={addCategory} disabled={loading || !newName.trim()}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Add Category
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {categories.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No categories yet. Click &quot;Load Defaults&quot; to get started.
          </p>
        ) : (
          <div className="space-y-2">
            {categories.map((cat) => (
              <div
                key={cat.id}
                className="flex items-center justify-between rounded-md border px-3 py-2"
              >
                {editingId === cat.id ? (
                  <div className="flex items-center gap-2 flex-1">
                    <Input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="h-8"
                      onKeyDown={(e) =>
                        e.key === "Enter" && updateCategory(cat.id)
                      }
                    />
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => updateCategory(cat.id)}
                    >
                      Save
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setEditingId(null)}
                    >
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <>
                    <span className="text-sm">{cat.name}</span>
                    <div className="flex items-center gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={() => {
                          setEditingId(cat.id);
                          setEditName(cat.name);
                        }}
                      >
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-destructive"
                        onClick={() => deleteCategory(cat.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
