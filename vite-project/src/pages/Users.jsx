import React, { useState, useEffect } from "react";
import { apiFetch } from "../utils/api";
import UsersTable from "../components/UsersTable";
import UserModal from "../components/UserModal";
import "./Users.css";

const Users = () => {
  const [users, setUsers]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(null);
  const [editingUser, setEditingUser] = useState(undefined); // undefined = closed, null = create, object = edit

  useEffect(() => { fetchUsers(); }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const res = await apiFetch("/api/users");
      if (!res.ok) throw new Error("Ошибка при загрузке сотрудников");
      setUsers(await res.json());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = () => {
    setEditingUser(undefined);
    fetchUsers();
  };

  if (loading) return <div className="loading">Загрузка...</div>;
  if (error)   return <div className="error">Ошибка: {error}</div>;

  return (
    <div className="page-container users-page" style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div className="page-header">
        <h1 className="page-title">Сотрудники</h1>
        <button className="btn btn-primary-green" onClick={() => setEditingUser(null)}>
          + Добавить сотрудника
        </button>
      </div>

      <UsersTable
        users={users}
        onEdit={user => setEditingUser(user)}
        onUpdate={fetchUsers}
      />

      {editingUser !== undefined && (
        <UserModal
          user={editingUser}
          onClose={() => setEditingUser(undefined)}
          onSave={handleSave}
        />
      )}
    </div>
  );
};

export default Users;
