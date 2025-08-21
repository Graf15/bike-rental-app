import React, { useState, useEffect } from "react";
import UsersTable from "../components/UsersTable";
import "./Users.css";

const Users = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await fetch("http://localhost:3001/api/users");
      if (!response.ok) {
        throw new Error("Ошибка при загрузке пользователей");
      }
      console.log("Response:", response);
      console.log("Response status:", response.status);
      const data = await response.json();
      console.log("Данные:", data);
      setUsers(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="loading">Загрузка...</div>;
  if (error) return <div className="error">Ошибка: {error}</div>;

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Управление менеджерами</h1>
        <button className="btn-primary">+ Добавить менеджера</button>
      </div>
      <UsersTable users={users} onUpdate={fetchUsers} />
    </div>
  );
};

export default Users;
