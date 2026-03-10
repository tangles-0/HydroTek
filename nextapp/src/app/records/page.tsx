"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/input";
import { useCreateRecord } from "@/hooks/records/useCreateRecord";
import { useFetchRecords } from "@/hooks/records/useFetchRecords";
import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import { useState } from "react";

export default function RecordsPage() {
  const { data: session } = useSession();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");

  const { data, isLoading } = useFetchRecords({ search, category });
  const createRecord = useCreateRecord();

  if (!session) {
    redirect("/");
  }

  const handleCreate = async () => {
    if (!newTitle) return;
    await createRecord.mutateAsync({
      title: newTitle,
      description: newDescription,
      category,
    });
    setNewTitle("");
    setNewDescription("");
  };

  return (
    <div className="container mx-auto p-8">
      <h1 className="text-3xl font-bold mb-6">Records Example</h1>

      {/* Create Record Form */}
      <Card className="p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Create New Record</h2>
        <div className="flex flex-col gap-4">
          <Input
            placeholder="Title"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
          />
          <Input
            placeholder="Description"
            value={newDescription}
            onChange={(e) => setNewDescription(e.target.value)}
          />
          <Button onClick={handleCreate} disabled={createRecord.isPending}>
            {createRecord.isPending ? "Creating..." : "Create Record"}
          </Button>
        </div>
      </Card>

      {/* Search & Filter Functionality */}
      <div className="flex gap-4 mb-6">
        <Input
          placeholder="Search records..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Input
          placeholder="Filter by category..."
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        />
      </div>

      {/* Records List */}
      {isLoading ? (
        <p>Loading...</p>
      ) : (
        <div className="grid gap-4">
          {data?.records?.length === 0 && (
            <p className="text-gray-500">No records yet. Create one above!</p>
          )}
          {data?.records?.map((record: any) => (
            <Card key={record.id} className="p-6">
              <h2 className="text-xl font-bold mb-2">{record.title}</h2>
              {record.description && (
                <p className="text-gray-600 mb-2">{record.description}</p>
              )}
              {record.category && (
                <span className="text-sm text-gray-500">
                  Category: {record.category}
                </span>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
