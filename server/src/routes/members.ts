import { Router } from 'express'
import { validate } from '../middleware/validate'
import {
  createMemberSchema,
  listMembersQuerySchema,
  memberIdParamSchema,
  updateMemberSchema,
} from '../validation/members'
import { asyncHandler } from '../utils/errors'
import {
  createMember,
  getMemberDetail,
  listMembers,
  setMemberStatus,
  updateMember,
  type ListMembersParams,
} from '../services/members'
import { serializeMember } from '../services/serializers'

const router = Router()

router.get(
  '/',
  validate({ query: listMembersQuerySchema }),
  asyncHandler(async (req, res) => {
    const result = await listMembers(req.query as unknown as ListMembersParams)
    res.json(result)
  }),
)

router.post(
  '/',
  validate({ body: createMemberSchema }),
  asyncHandler(async (req, res) => {
    const member = await createMember(req.body)
    res.status(201).json({ member: serializeMember(member) })
  }),
)

router.get(
  '/:id',
  validate({ params: memberIdParamSchema }),
  asyncHandler(async (req, res) => {
    res.json(await getMemberDetail(req.params.id))
  }),
)

router.patch(
  '/:id',
  validate({ params: memberIdParamSchema, body: updateMemberSchema }),
  asyncHandler(async (req, res) => {
    const member = await updateMember(req.params.id, req.body)
    res.json({ member: serializeMember(member) })
  }),
)

router.post(
  '/:id/deactivate',
  validate({ params: memberIdParamSchema }),
  asyncHandler(async (req, res) => {
    const member = await setMemberStatus(req.params.id, 'inactive')
    res.json({ member: serializeMember(member) })
  }),
)

router.post(
  '/:id/activate',
  validate({ params: memberIdParamSchema }),
  asyncHandler(async (req, res) => {
    const member = await setMemberStatus(req.params.id, 'active')
    res.json({ member: serializeMember(member) })
  }),
)

export default router
