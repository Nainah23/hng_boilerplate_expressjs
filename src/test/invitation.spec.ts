import { InviteService } from "../services";
import { Repository } from "typeorm";
import { Invitation, Organization, User, UserOrganization } from "../models";
import AppDataSource from "../data-source";
import { ResourceNotFound, Conflict } from "../middleware";
import { addEmailToQueue } from "../utils/queue";
import config from "../config";

jest.mock("../data-source");
jest.mock("../utils/queue");
jest.mock("../views/email/renderTemplate");
jest.mock("uuid", () => ({ v4: jest.fn(() => "some-uuid-token") }));

const frontendBaseUrl = config.BASE_URL;

describe("InviteService", () => {
  let inviteService: InviteService;
  let inviteRepository: jest.Mocked<Repository<Invitation>>;
  let organizationRepository: jest.Mocked<Repository<Organization>>;
  let userOrganizationRepository: jest.Mocked<Repository<UserOrganization>>;
  let userRepository: jest.Mocked<Repository<User>>;

  beforeEach(() => {
    inviteRepository = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    } as any;
    organizationRepository = {
      findOne: jest.fn(),
    } as any;
    userOrganizationRepository = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    } as any;
    userRepository = {
      findOne: jest.fn(),
    } as any;

    AppDataSource.getRepository = jest.fn().mockImplementation((model) => {
      switch (model) {
        case Invitation:
          return inviteRepository;
        case Organization:
          return organizationRepository;
        case UserOrganization:
          return userOrganizationRepository;
        case User:
          return userRepository;
        default:
          throw new Error("Unknown model");
      }
    });

    inviteService = new InviteService();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("generateGenericInviteLink", () => {
    it("should generate a generic invite link", async () => {
      const organizationId = "org-123";
      const organization = { id: organizationId } as Organization;

      organizationRepository.findOne.mockResolvedValue(organization);
      inviteRepository.create.mockReturnValue({
        token: "some-uuid-token",
        isGeneric: true,
        organization,
      } as Invitation);

      const result =
        await inviteService.generateGenericInviteLink(organizationId);

      expect(organizationRepository.findOne).toHaveBeenCalledWith({
        where: { id: organizationId },
      });
      expect(inviteRepository.create).toHaveBeenCalledWith({
        token: "some-uuid-token",
        isGeneric: true,
        organization: { id: organizationId },
      });
      expect(inviteRepository.save).toHaveBeenCalledWith({
        token: "some-uuid-token",
        isGeneric: true,
        organization,
      });
      expect(result).toBe(`${frontendBaseUrl}/invite?token=some-uuid-token`);
    });

    it("should throw ResourceNotFound if organization does not exist", async () => {
      const organizationId = "org-123";

      organizationRepository.findOne.mockResolvedValue(null);

      await expect(
        inviteService.generateGenericInviteLink(organizationId),
      ).rejects.toThrow(ResourceNotFound);
    });
  });
});
