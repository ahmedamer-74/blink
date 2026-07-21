import { NotFoundError } from "@repo/utils";
import { UsersRepository } from "./users.repository.js";
import { buildPaginationMeta } from "@repo/utils";
import type { PaginationQuery } from "@repo/types";

export class UsersService {
  private repo = new UsersRepository();

  async findById(id: string) {
    const user = await this.repo.findById(id);
    if (!user) throw new NotFoundError("User");
    return user;
  }

  async search(query: string) {
    return this.repo.search(query);
  }

  async findAll(query: PaginationQuery) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const { users, total } = await this.repo.findAll(page, limit);
    return { users, meta: buildPaginationMeta(total, page, limit) };
  }

  async update(id: string, data: { email?: string; username?: string; avatar?: string }) {
    const user = await this.repo.findById(id);
    if (!user) throw new NotFoundError("User");
    return this.repo.update(id, data);
  }

  async delete(id: string) {
    const user = await this.repo.findById(id);
    if (!user) throw new NotFoundError("User");
    return this.repo.delete(id);
  }
}
