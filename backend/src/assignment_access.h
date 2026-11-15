#pragma once

#include "assignment.h"
#include "auth.h"

// admins can manage any assignment
// educators can manage only assignments they created
inline bool canManageAssignment(const CurrentUser& user, const Assignment& assignment) {
    if (user.role == Role::Admin) return true;

    return user.role == Role::Educator &&
           !user.id.empty() &&
           !assignment.assignedBy.empty() &&
           assignment.assignedBy == user.id;
}

// students can access their own assignments
// educators and admins use the management rule above
inline bool canAccessAssignment(const CurrentUser& user, const Assignment& assignment) {
    if (canManageAssignment(user, assignment)) return true;

    return user.role == Role::Student &&
           !user.id.empty() &&
           assignment.studentId == user.id;
}
